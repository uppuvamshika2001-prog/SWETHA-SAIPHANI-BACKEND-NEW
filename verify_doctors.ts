
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const doctors = await prisma.user.findMany({
            where: {
                role: 'DOCTOR' // Ensure this matches the enum case in your schema
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                staff: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true
                    }
                }
            }
        });

        console.log('--- Doctors in DB ---');
        console.log(JSON.stringify(doctors, null, 2));
        console.log('---------------------');
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
