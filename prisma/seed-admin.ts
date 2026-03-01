import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
    const email = 'drsaiphanib@gmail.com';
    const password = 'Ssclinics@2025';

    console.log(`Seeding admin user: ${email}`);

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email },
    });

    if (existingAdmin) {
        console.log('Admin user already exists. Updating password...');
        const passwordHash = await hashPassword(password);
        await prisma.user.update({
            where: { email },
            data: {
                passwordHash,
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
            },
        });
        console.log('Admin password updated.');
    } else {
        console.log('Creating new admin user...');
        const passwordHash = await hashPassword(password);
        await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
            }
        });
        console.log('Admin user created.');

        // Also create a Staff profile for the admin just in case it's needed for foreign keys elsewhere (though User is the main auth entity)
        // admin usually doesn't need staff profile unless they are also a doctor, but for completness of "USER" table it's fine.
        // However, the system seems to link User to either Patient or Staff.
        // Let's check schema. User has optional staff.
        // If this admin is also a doctor, they might need a Staff entry.
        // The credentials suggest "Dr...", so likely a doctor.
        // But for now, we just ensure the LOGIN works. We can add Staff entry if needed.
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
