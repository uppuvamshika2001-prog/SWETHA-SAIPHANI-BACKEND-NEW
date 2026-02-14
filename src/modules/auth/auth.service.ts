import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';
import { randomUUID } from 'node:crypto';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    getRefreshTokenExpiry,
    TokenPayload,
} from '../../utils/jwt.js';
import {
    UnauthorizedError,
    ConflictError,
    NotFoundError,
    InvalidCredentialsError,
    TokenError,
    DatabaseError,
} from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import {
    LoginInput,
    RegisterInput,
    AuthResponse,
    AuthTokens,
    ChangePasswordInput,
} from './auth.types.js';
import { UserRole, Gender } from '@prisma/client';

export class AuthService {
    async register(input: RegisterInput): Promise<AuthResponse> {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Hash password
        const passwordHash = await hashPassword(input.password);

        // Create user with transaction
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email: input.email,
                    passwordHash,
                    role: input.role || UserRole.PATIENT,
                },
            });

            // Create associated profile based on role
            if (input.role === UserRole.PATIENT || !input.role) {
                // Check if patient with this email or phone already exists and is not linked
                const orphanCriteria: any[] = [];
                if (input.email) {
                    orphanCriteria.push({ email: input.email });
                }
                if (input.phone) {
                    orphanCriteria.push({ phone: input.phone });
                }

                const existingPatient = orphanCriteria.length > 0 ? await tx.patient.findFirst({
                    where: {
                        OR: orphanCriteria,
                        userId: null
                    }
                }) : null;

                if (existingPatient) {
                    // Link existing and update email if not present
                    await tx.patient.update({
                        where: { uhid: existingPatient.uhid },
                        data: {
                            userId: newUser.id,
                            email: existingPatient.email || input.email // Ensure email is set
                        }
                    });
                } else {
                    await tx.patient.create({
                        data: {
                            uhid: randomUUID(),
                            userId: newUser.id,
                            firstName: input.firstName,
                            lastName: input.lastName,
                            phone: input.phone || '',
                            email: input.email,
                            dateOfBirth: new Date(), // TODO: Add to registration
                            gender: Gender.OTHER, // TODO: Add to registration
                        },
                    });
                }
            } else {
                await tx.staff.create({
                    data: {
                        userId: newUser.id,
                        firstName: input.firstName,
                        lastName: input.lastName,
                        phone: input.phone,
                        specialization: input.department, // Map department to specialization
                    },
                });
            }

            return newUser;
        });

        // Generate tokens
        const tokens = await this.generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            tokens,
        };
    }

    async login(input: LoginInput): Promise<AuthResponse> {
        try {
            // Safely query user - wrapped in try-catch
            let user;
            try {
                user = await prisma.user.findUnique({
                    where: { email: input.email },
                });
            } catch (dbError) {
                logger.error({ error: dbError }, 'Database error during login');
                throw new DatabaseError('Unable to process login request');
            }

            // Security best practice: Don't reveal if email exists
            // Use generic "Invalid credentials" message for both cases
            if (!user) {
                logger.warn({ email: input.email }, 'Login attempt for non-existent user');
                throw new InvalidCredentialsError();
            }

            // Check if account is active
            if (user.status !== 'ACTIVE') {
                logger.warn({ userId: user.id, status: user.status }, 'Login attempt for inactive account');
                throw new UnauthorizedError(
                    'Account is disabled. Please contact administrator.',
                    'AUTH_ACCOUNT_DISABLED'
                );
            }

            // Verify password - wrapped in try-catch
            let isValidPassword: boolean;
            try {
                isValidPassword = await verifyPassword(input.password, user.passwordHash);
            } catch (cryptoError) {
                logger.error({ error: cryptoError }, 'Crypto error during password verification');
                throw new DatabaseError('Unable to verify credentials');
            }

            if (!isValidPassword) {
                logger.warn({ userId: user.id }, 'Failed login - invalid password');
                throw new InvalidCredentialsError();
            }

            // Generate tokens - wrapped in try-catch
            let tokens: AuthTokens;
            try {
                tokens = await this.generateTokens({
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                });
            } catch (tokenError) {
                logger.error({ error: tokenError, userId: user.id }, 'Error generating tokens');
                throw new DatabaseError('Unable to complete login');
            }

            logger.info({ userId: user.id, role: user.role }, 'User logged in successfully');

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
                tokens,
            };
        } catch (error) {
            // Re-throw AppError subclasses as-is
            if (error instanceof InvalidCredentialsError ||
                error instanceof UnauthorizedError ||
                error instanceof DatabaseError) {
                throw error;
            }
            // Wrap unknown errors safely
            logger.error({ error }, 'Unexpected error during login');
            throw new DatabaseError('An unexpected error occurred during login');
        }
    }

    async refreshToken(refreshToken: string): Promise<AuthTokens> {
        // Verify refresh token
        let decoded: TokenPayload;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch {
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Check if token exists in database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!storedToken) {
            throw new UnauthorizedError('Refresh token not found');
        }

        if (storedToken.expiresAt < new Date()) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            throw new UnauthorizedError('Refresh token expired');
        }

        if (storedToken.user.status !== 'ACTIVE') {
            throw new UnauthorizedError('Account is disabled');
        }

        // Delete old token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });

        // Generate new tokens
        return this.generateTokens({
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        });
    }

    async logout(refreshToken: string): Promise<void> {
        await prisma.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
    }

    async logoutAll(userId: string): Promise<void> {
        await prisma.refreshToken.deleteMany({
            where: { userId },
        });
    }

    async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const isValidPassword = await verifyPassword(input.currentPassword, user.passwordHash);

        if (!isValidPassword) {
            throw new UnauthorizedError('Current password is incorrect');
        }

        const newPasswordHash = await hashPassword(input.newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash },
        });

        // Invalidate all refresh tokens
        await this.logoutAll(userId);
    }

    private async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Store refresh token in database
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: payload.userId,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: config.jwt.accessExpiry,
        };
    }
}

export const authService = new AuthService();
