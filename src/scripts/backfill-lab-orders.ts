import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
    console.log('🔍 Starting Comprehensive Lab Order Backfill...');

    // 1. Get ALL orders regardless of their current testId
    const orders = await prisma.labTestOrder.findMany();

    console.log(`📋 Found ${orders.length} total lab orders to verify and backfill.`);

    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let failedCount = 0;

    const normalizationMap: Record<string, string> = {
        'Complete Blood Picture': 'CBP',
        'Complete Blood Picture (CBP)': 'CBP',
        'CBC': 'CBP',
        'Complete Urine Examination': 'CUE',
        'Complete Urine Examination (CUE)': 'CUE',
        'URINE': 'CUE',
        'Liver Function Test': 'LFT',
        'Renal Function Test': 'RFT',
        'B_UREA': 'BLOOD_UREA',
        'CREATININE': 'SERUM_CREATININE',
        'CALCIUM': 'SERUM_CALCIUM',
        'ELECTRO': 'SERUM_ELECTROLYTES',
        'THYROID': 'THYROID_PROFILE',
        'LIPID': 'LIPID_PROFILE',
        'ESR (Erythrocyte Sedimentation Rate)': 'ESR',
        'ERYTHROCYTE SEDIMENTATION RATE(ESR)': 'ESR',
        'Erythrocyte Sedimentation Rate': 'ESR',
        'CRP RESULT': 'CRP',
        'C-Reactive Protein': 'CRP',
        'C-Reactive Protein (CRP)': 'CRP'
    };

    for (const order of orders) {
        try {
            // Check normalization map first
            let searchKey = (order.testCode || order.testName || '').trim();
            let targetCode = normalizationMap[searchKey] || searchKey;

            const resolvedTest = await (prisma.labTest as any).findFirst({
                where: {
                    isActive: true,
                    // Require the test to actually have parameters (either directly or via categories)
                    OR: [
                        { parameters: { some: {} } },
                        { categories: { some: { parameters: { some: {} } } } }
                    ],
                    AND: [
                        {
                            OR: [
                                { code: { equals: targetCode, mode: 'insensitive' } },
                                { name: { equals: order.testName, mode: 'insensitive' } },
                                { name: { contains: order.testName, mode: 'insensitive' } },
                                { code: { contains: order.testName, mode: 'insensitive' } },
                                { code: { equals: searchKey, mode: 'insensitive' } }
                            ]
                        }
                    ]
                },
                select: { id: true, name: true, code: true }
            });

            if (resolvedTest) {
                // If the order already points to this EXACT canonical test ID, it's correct
                if (order.testId === resolvedTest.id) {
                    alreadyCorrectCount++;
                } else {
                    // 3. Update the order with the correct canonical testId
                    await prisma.labTestOrder.update({
                        where: { id: order.id },
                        data: {
                            testId: resolvedTest.id,
                            testName: resolvedTest.name,
                            testCode: resolvedTest.code
                        }
                    });
                    updatedCount++;
                    console.log(`✅ Fixed Order ${order.id}: '${order.testName}' -> canonical test '${resolvedTest.name}' (${resolvedTest.id})`);
                }
            } else {
                failedCount++;
                console.warn(`⚠️ Could not find parameterized canonical test for Order ${order.id}: '${order.testName}' (code: ${order.testCode})`);
            }
        } catch (error) {
            failedCount++;
            console.error(`❌ Error updating Order ${order.id}:`, error);
        }
    }

    console.log('\n--- Backfill Summary ---');
    console.log(`Total processed  : ${orders.length}`);
    console.log(`Already correct  : ${alreadyCorrectCount}`);
    console.log(`Successfully fixed: ${updatedCount}`);
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
