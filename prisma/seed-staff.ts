import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding staff users...\n');

    const staffUsers = [
        { email: 'krishnayadav.vamshi@gmail.com', password: 'Ssclinics@2025', role: UserRole.RECEPTIONIST, firstName: 'Vamshi', lastName: 'Krishna Yadav', department: 'Reception' },
        { email: 'pharmacist@ssclinics.com', password: 'Ssclinics@2025', role: UserRole.PHARMACIST, firstName: 'Pharmacy', lastName: 'Staff', department: 'Pharmacy' },
        { email: 'labtech@ssclinics.com', password: 'Ssclinics@2025', role: UserRole.LAB_TECHNICIAN, firstName: 'Lab', lastName: 'Technician', department: 'Laboratory' },
    ];

    for (const staff of staffUsers) {
        const existing = await prisma.user.findUnique({ where: { email: staff.email } });
        
        if (existing) {
            console.log(`  ⏩ ${staff.email} already exists, updating password...`);
            const passwordHash = await hashPassword(staff.password);
            await prisma.user.update({
                where: { email: staff.email },
                data: { passwordHash, role: staff.role, status: UserStatus.ACTIVE },
            });
        } else {
            console.log(`  Creating ${staff.role}: ${staff.email}`);
            const passwordHash = await hashPassword(staff.password);
            const user = await prisma.user.create({
                data: {
                    email: staff.email,
                    passwordHash,
                    role: staff.role,
                    status: UserStatus.ACTIVE,
                },
            });

            // Create Staff profile
            await prisma.staff.create({
                data: {
                    userId: user.id,
                    firstName: staff.firstName,
                    lastName: staff.lastName,
                    department: staff.department,
                    status: UserStatus.ACTIVE,
                },
            });
            console.log(`  ✅ ${staff.role} created: ${staff.email}`);
        }
    }

    console.log('\n✅ All staff users seeded!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
