import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting lab order migration...');

    // 1. Get all lab orders that don't have a testId
    const orders = await prisma.labTestOrder.findMany({
        where: {
            testId: null
        }
    });

    console.log(`Found ${orders.length} orders to migrate.`);

    let migratedCount = 0;
    
    for (const order of orders) {
        // Try to find a matching test in the catalog
        const test = await prisma.labTest.findFirst({
            where: {
                OR: [
                    { code: order.testCode || '___NON_EXISTENT___' },
                    { name: order.testName }
                ]
            }
        });

        if (test) {
            await prisma.labTestOrder.update({
                where: { id: order.id },
                data: { testId: test.id }
            });
            migratedCount++;
        }
    }

    console.log(`Migration completed. ${migratedCount} orders updated.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
