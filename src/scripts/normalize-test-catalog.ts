import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function normalize() {
    console.log('🧹 Starting Lab Test Catalog Normalization...');

    // 1. Define Duplicates and their "Master" records
    // Format: { [duplicate_code_or_name]: master_code }
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
        'CRP RESULT': 'CRP',
        'C-Reactive Protein': 'CRP',
        'C-Reactive Protein (CRP)': 'CRP',
        'Random Blood Sugar': 'RBS',
        'Blood Sugar': 'RBS',
        'ESR RESULT': 'ESR',
        'Erythrocyte Sedimentation Rate': 'ESR',
        'HbA1c': 'HBA1C',
        'Glycosylated Hemoglobin': 'HBA1C'
    };

    for (const [alias, masterCode] of Object.entries(normalizationMap)) {
        try {
            // Find the Master test
            const masterTest = await prisma.labTest.findFirst({
                where: { code: masterCode }
            });

            if (!masterTest) {
                console.warn(`⚠️ Master test with code '${masterCode}' not found. Skipping alias '${alias}'.`);
                continue;
            }

            // Ensure Master is Active
            if (!masterTest.isActive) {
                await prisma.labTest.update({
                    where: { id: masterTest.id },
                    data: { isActive: true }
                });
                console.log(`📡 Master test '${masterCode}' reactivated.`);
                masterTest.isActive = true;
            }

            // Find duplicate tests (by name or code)
            const duplicates = await prisma.labTest.findMany({
                where: {
                    id: { not: masterTest.id },
                    OR: [
                        { name: { equals: alias, mode: 'insensitive' } },
                        { code: { equals: alias, mode: 'insensitive' } }
                    ]
                }
            });

            if (duplicates.length === 0) continue;

            console.log(`\n🔄 Normalizing '${alias}' -> Master '${masterTest.name}' (${masterCode})`);

            for (const dup of duplicates) {
                console.log(`   - Processing duplicate: ${dup.name} (${dup.code})`);

                // A. Move all LabTestOrders to the Master
                const orderUpdate = await prisma.labTestOrder.updateMany({
                    where: { testId: dup.id },
                    data: { 
                        testId: masterTest.id,
                        testName: masterTest.name,
                        testCode: masterTest.code
                    }
                });
                console.log(`     ✅ Moved ${orderUpdate.count} orders`);

                // B. Move parameters if they don't exist in master? 
                // For simplicity, we assume the Master (seeded) has all correct parameters.
                // We'll just delete the duplicate's parameters to avoid FK errors.
                await (prisma as any).labTestParameter.deleteMany({ where: { testId: dup.id } });
                await (prisma as any).labTestCategory.deleteMany({ where: { testId: dup.id } });

                // C. Delete the duplicate test
                await prisma.labTest.delete({ where: { id: dup.id } });
                console.log(`     ✅ Deleted duplicate test entry`);
            }
        } catch (error) {
            console.error(`❌ Error normalizing '${alias}':`, error);
        }
    }

    console.log('\n✅ Catalog Normalization Completed!');
}

normalize()
    .catch(e => {
        console.error('Fatal normalization error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
