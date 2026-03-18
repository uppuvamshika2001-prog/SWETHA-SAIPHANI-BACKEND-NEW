import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repair() {
    console.log('🧪 Starting Lab Test Catalog Repair...');

    // List of master test codes from seed.ts
    const masterCodes = [
        'CBP', 'CUE', 'LFT', 'RFT', 'LIPID_PROFILE', 'THYROID_PROFILE', 
        'SERUM_ELECTROLYTES', 'WIDAL', 'DENGUE', 'CRP', 'HBA1C', 
        'BLOOD_UREA', 'SERUM_CREATININE', 'SERUM_CALCIUM', 'RBS', 
        'MP', 'HIV', 'HBSAG', 'HCV', 'XRAY'
    ];

    const result = await prisma.labTest.updateMany({
        where: {
            code: { in: masterCodes },
            isActive: false
        },
        data: {
            isActive: true
        }
    });

    console.log(`✅ Repaired ${result.count} hidden master tests.`);
    console.log('🎉 Catalog visibility restored!');
}

repair()
    .catch(e => {
        console.error('❌ Repair failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
