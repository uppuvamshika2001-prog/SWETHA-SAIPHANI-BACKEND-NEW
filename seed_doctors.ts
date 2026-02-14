
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hashPassword } from './src/utils/crypto';

const prisma = new PrismaClient();

const doctors = [
    { name: 'Dr.B.Sai Phani Chandra', email: 'drsai@swethaclinics.com' },
    { name: 'Dr.D.Hari Prakash', email: 'drhari@swethaclinics.com' },
    { name: 'Dr.Roshan Kumar Jaiswal', email: 'drroshan@swethaclinics.com' },
    { name: 'Dr.Swetha Pendyala', email: 'drswetha@swethaclinics.com' },
    { name: 'Dr.Ravikanti Nagaraju', email: 'drravikanti@swethaclinics.com' },
];

async function main() {
    console.log('Seeding doctors...');
    const passwordHash = await hashPassword('Doctor123!');

    for (const doc of doctors) {
        const names = doc.name.split(' ');
        // Logic to split name vaguely: Dr.X Y Z -> First: Dr.X, Last: Y Z
        // Ideally we strip Dr. 
        const cleanName = doc.name.replace(/^Dr\./, '').trim();
        const [firstName, ...lastNameParts] = cleanName.split(' ');
        const lastName = lastNameParts.join(' ');

        const existingUser = await prisma.user.findUnique({
            where: { email: doc.email },
        });

        if (!existingUser) {
            await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: doc.email,
                        passwordHash,
                        role: UserRole.DOCTOR,
                        status: UserStatus.ACTIVE,
                    },
                });

                await tx.staff.create({
                    data: {
                        userId: user.id,
                        firstName: firstName || 'Dr.',
                        lastName: lastName || doc.name,
                        specialization: 'General', // Default
                        department: 'General',     // Default
                    },
                });
                console.log(`Created ${doc.name}`);
            });
        } else {
            console.log(`${doc.name} already exists.`);
        }
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
