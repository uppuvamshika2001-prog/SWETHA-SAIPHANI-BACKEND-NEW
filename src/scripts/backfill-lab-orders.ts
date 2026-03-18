import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
    console.log('🔍 Starting Lab Order Backfill...');

    // 1. Get all orders without a testId
    const orders = await prisma.labTestOrder.findMany({
        where: {
            testId: null
        }
    });

    console.log(`📋 Found ${orders.length} orders to backfill.`);

    let updatedCount = 0;
    let failedCount = 0;

    for (const order of orders) {
        try {
            // 2. Try to find the matching test in the catalog
            const resolvedTest = await prisma.labTest.findFirst({
                where: {
                    OR: [
                        { code: { equals: order.testCode || order.testName, mode: 'insensitive' } },
                        { name: { equals: order.testName, mode: 'insensitive' } },
                        { name: { contains: order.testName, mode: 'insensitive' } },
                        { code: { contains: order.testName, mode: 'insensitive' } }
                    ]
                }
            });

            if (resolvedTest) {
                // 3. Update the order with testId and synced name/code
                await prisma.labTestOrder.update({
                    where: { id: order.id },
                    data: {
                        testId: resolvedTest.id,
                        testName: resolvedTest.name,
                        testCode: resolvedTest.code
                    }
                });
                updatedCount++;
                console.log(`✅ Updated Order ${order.id}: ${order.testName} -> ${resolvedTest.name} (${resolvedTest.id})`);
            } else {
                failedCount++;
                console.warn(`⚠️ Could not resolve test for Order ${order.id}: ${order.testName}`);
            }
        } catch (error) {
            failedCount++;
            console.error(`❌ Error updating Order ${order.id}:`, error);
        }
    }

    console.log('\n--- Backfill Summary ---');
    console.log(`Total processed: ${orders.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Failed to resolve: ${failedCount}`);
    console.log('------------------------');
}

backfill()
    .catch(e => {
        console.error('Fatal backfill error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
