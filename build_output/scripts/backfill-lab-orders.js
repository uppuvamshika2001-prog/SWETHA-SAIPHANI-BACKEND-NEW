import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function backfill() {
    console.log('🔍 Starting Diagnostic Lab Order Backfill...');
    // 1. Get ALL orders regardless of their current testId
    const orders = await prisma.labTestOrder.findMany();
    console.log(`📋 Found ${orders.length} total lab orders to verify and backfill.`);
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let failedCount = 0;
    const normalizationMap = {
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
        'THYROID_PROFILE': 'THYROID_PROFILE',
        'THYROID PROFILE': 'THYROID_PROFILE',
        'THYROID PROFILE ': 'THYROID_PROFILE',
        'LIPID': 'LIPID_PROFILE',
        'ESR (Erythrocyte Sedimentation Rate)': 'ESR',
        'ERYTHROCYTE SEDIMENTATION RATE(ESR)': 'ESR',
        'Erythrocyte Sedimentation Rate': 'ESR',
        'ERYTHROCYTE SEDIMENTATION RATE (ESR)': 'ESR',
        'HME008': 'ESR',
        'CRP RESULT': 'CRP',
        'C-Reactive Protein': 'CRP',
        'C-Reactive Protein (CRP)': 'CRP'
    };
    for (const order of orders) {
        try {
            // Map BOTH name and code, prioritize finding a valid target
            let rawName = (order.testName || '').trim();
            let rawCode = (order.testCode || '').trim();
            let targetCode = normalizationMap[rawCode] || normalizationMap[rawName] || rawCode || rawName;
            // 2. Find ALL tests that match the target code or name exactly to see what exists
            const potentialTests = await prisma.labTest.findMany({
                where: {
                    OR: [
                        { code: { equals: targetCode, mode: 'insensitive' } },
                        { name: { equals: rawName, mode: 'insensitive' } },
                        { code: { equals: rawCode, mode: 'insensitive' } },
                        { name: { contains: rawName, mode: 'insensitive' } }
                    ]
                },
                include: {
                    categories: { include: { parameters: true } },
                    parameters: true
                }
            });
            if (potentialTests.length === 0) {
                failedCount++;
                console.warn(`⚠️ [NOT FOUND] No test matches '${rawName}' OR code '${rawCode}' (target: ${targetCode})`);
                continue;
            }
            // 3. Filter for the BEST one: must be active AND have parameters
            let bestTest = potentialTests.find((t) => {
                const hasParams = (t.parameters && t.parameters.length > 0) ||
                    (t.categories && t.categories.some((c) => c.parameters && c.parameters.length > 0));
                return t.isActive && hasParams;
            });
            // If none are perfect, log deep diagnostic info about why they failed
            if (!bestTest) {
                failedCount++;
                console.warn(`⚠️ [NO VALID TEST] Found ${potentialTests.length} matches for Order ${order.id} ('${rawName}' / '${rawCode}'), but NONE are fully valid!`);
                potentialTests.forEach((t, i) => {
                    const hasParams = (t.parameters && t.parameters.length > 0) ||
                        (t.categories && t.categories.some((c) => c.parameters && c.parameters.length > 0));
                    console.log(`   -> Match ${i + 1}: ID=${t.id}, Code='${t.code}', Active=${t.isActive}, HasParams=${hasParams}`);
                });
                continue;
            }
            // 4. Update the order with the correct canonical testId
            if (order.testId === bestTest.id) {
                alreadyCorrectCount++;
            }
            else {
                await prisma.labTestOrder.update({
                    where: { id: order.id },
                    data: {
                        testId: bestTest.id,
                        testName: bestTest.name,
                        testCode: bestTest.code
                    }
                });
                updatedCount++;
                console.log(`✅ Fixed Order ${order.id}: '${rawName}' -> canonical test '${bestTest.name}' (${bestTest.id})`);
            }
        }
        catch (error) {
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
//# sourceMappingURL=backfill-lab-orders.js.map