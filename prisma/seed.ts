import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding lab test master data...');

    // First, clean out old data to avoid duplicates
    console.log('  Clearing existing lab test data...');
    await (prisma as any).labTestParameter.deleteMany({});
    await (prisma as any).labTestCategory.deleteMany({});

    // =========================
    // 1. CBP - Complete Blood Picture
    // =========================
    const cbp = await prisma.labTest.upsert({
        where: { code: 'CBP' },
        update: { name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', price: 500 },
        create: { code: 'CBP', name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', price: 500 },
    });
    console.log('  ✅ CBP test created/updated');

    const cbpHema = await (prisma as any).labTestCategory.create({
        data: { testId: cbp.id, name: 'HEMATOLOGY', displayOrder: 1 },
    });
    const cbpDiff = await (prisma as any).labTestCategory.create({
        data: { testId: cbp.id, name: 'DIFFERENTIAL COUNT', displayOrder: 2 },
    });
    const cbpSmear = await (prisma as any).labTestCategory.create({
        data: { testId: cbp.id, name: 'PERIPHERAL SMEAR', displayOrder: 3 },
    });

    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Hemoglobin', unit: 'gm%', inputType: 'number', referenceRange: { male: '13.5 - 17.5', female: '12.5 - 16.5' }, displayOrder: 1 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Total Erythrocyte Count (RBC)', unit: 'Millions/cumm', inputType: 'number', referenceRange: { default: '4.0 - 6.2' }, displayOrder: 2 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Packed Cell Volume (PCV)', unit: '%', inputType: 'number', referenceRange: { default: '37 - 54' }, displayOrder: 3 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Mean Corpuscular Volume (MCV)', unit: 'fl', inputType: 'number', referenceRange: { default: '78 - 100' }, displayOrder: 4 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Mean Corpuscular Hb (MCH)', unit: 'pg', inputType: 'number', referenceRange: { default: '27 - 31' }, displayOrder: 5 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Mean Corpuscular Hb Conc (MCHC)', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '32 - 36' }, displayOrder: 6 },
            { testId: cbp.id, categoryId: cbpHema.id, parameterName: 'Total Leucocyte Count (WBC)', unit: '/cumm', inputType: 'number', referenceRange: { default: '4000 - 10000' }, displayOrder: 7 },

            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Neutrophils', unit: '%', inputType: 'number', referenceRange: { default: '40 - 75' }, displayOrder: 1 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Lymphocytes', unit: '%', inputType: 'number', referenceRange: { default: '20 - 40' }, displayOrder: 2 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Eosinophils', unit: '%', inputType: 'number', referenceRange: { default: '1 - 6' }, displayOrder: 3 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Monocytes', unit: '%', inputType: 'number', referenceRange: { default: '2 - 10' }, displayOrder: 4 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Basophils', unit: '%', inputType: 'number', referenceRange: { default: '0 - 1' }, displayOrder: 5 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'Platelet Count', unit: 'Lakhs/cumm', inputType: 'number', referenceRange: { default: '1.5 - 4.5' }, displayOrder: 6 },
            { testId: cbp.id, categoryId: cbpDiff.id, parameterName: 'ESR', unit: 'mm/1st hr', inputType: 'number', referenceRange: { male: '0 - 10', female: '0 - 20' }, displayOrder: 7 },

            { testId: cbp.id, categoryId: cbpSmear.id, parameterName: 'RBC Morphology', unit: '', inputType: 'text', referenceRange: null, displayOrder: 1 },
            { testId: cbp.id, categoryId: cbpSmear.id, parameterName: 'WBC Morphology', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
            { testId: cbp.id, categoryId: cbpSmear.id, parameterName: 'Platelet Morphology', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
        ],
    });
    console.log('  ✅ CBP parameters seeded');

    // =========================
    // 2. CUE - Complete Urine Examination
    // =========================
    const cue = await prisma.labTest.upsert({
        where: { code: 'CUE' },
        update: { name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', price: 300 },
        create: { code: 'CUE', name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', price: 300 },
    });
    console.log('  ✅ CUE test created/updated');

    const cuePhys = await (prisma as any).labTestCategory.create({
        data: { testId: cue.id, name: 'PHYSICAL EXAMINATION', displayOrder: 1 },
    });
    const cueChem = await (prisma as any).labTestCategory.create({
        data: { testId: cue.id, name: 'CHEMICAL EXAMINATION', displayOrder: 2 },
    });
    const cueMicro = await (prisma as any).labTestCategory.create({
        data: { testId: cue.id, name: 'MICROSCOPIC EXAMINATION', displayOrder: 3 },
    });

    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: cue.id, categoryId: cuePhys.id, parameterName: 'Quantity', unit: 'ml', inputType: 'number', referenceRange: null, displayOrder: 1 },
            { testId: cue.id, categoryId: cuePhys.id, parameterName: 'Colour', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
            { testId: cue.id, categoryId: cuePhys.id, parameterName: 'Appearance', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
            { testId: cue.id, categoryId: cuePhys.id, parameterName: 'Reaction (pH)', unit: '', inputType: 'number', referenceRange: { default: '5.0 - 7.0' }, displayOrder: 4 },
            { testId: cue.id, categoryId: cuePhys.id, parameterName: 'Specific Gravity', unit: '', inputType: 'number', referenceRange: { default: '1.005 - 1.025' }, displayOrder: 5 },

            { testId: cue.id, categoryId: cueChem.id, parameterName: 'Proteins', unit: '', inputType: 'text', referenceRange: null, displayOrder: 1 },
            { testId: cue.id, categoryId: cueChem.id, parameterName: 'Sugar', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
            { testId: cue.id, categoryId: cueChem.id, parameterName: 'Ketone Bodies', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
            { testId: cue.id, categoryId: cueChem.id, parameterName: 'Bile Salts & Bile Pigments', unit: '', inputType: 'text', referenceRange: null, displayOrder: 4 },
            { testId: cue.id, categoryId: cueChem.id, parameterName: 'Urobilinogen', unit: '', inputType: 'text', referenceRange: null, displayOrder: 5 },

            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'R.B.C', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 1 },
            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'Pus (WBC) Cells', unit: '/HPF', inputType: 'text', referenceRange: null, displayOrder: 2 },
            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'Epithelial Cells', unit: '/HPF', inputType: 'text', referenceRange: null, displayOrder: 3 },
            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'Casts', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 4 },
            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'Crystals', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 5 },
            { testId: cue.id, categoryId: cueMicro.id, parameterName: 'Others', unit: '', inputType: 'text', referenceRange: null, displayOrder: 6 },
        ],
    });
    console.log('  ✅ CUE parameters seeded');

    // =========================
    // 3. LFT - Liver Function Test
    // =========================
    const lft = await prisma.labTest.upsert({
        where: { code: 'LFT' },
        update: { name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', price: 1200 },
        create: { code: 'LFT', name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', price: 1200 },
    });
    console.log('  ✅ LFT test created/updated');

    const lftCat = await (prisma as any).labTestCategory.create({
        data: { testId: lft.id, name: 'BIO CHEMISTRY', displayOrder: 1 },
    });

    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Bilirubin Total', unit: 'mg/dl', inputType: 'number', referenceRange: { adults: '0.1 - 1.2', newborn: '0.1 - 12.6' }, displayOrder: 1 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Bilirubin Direct', unit: 'mg/dl', inputType: 'number', referenceRange: { default: 'Upto 0.3' }, displayOrder: 2 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Bilirubin Indirect', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '0.3 - 1.0' }, displayOrder: 3 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Alkaline Phosphatase', unit: 'U/L', inputType: 'number', referenceRange: { adults: '53 - 141' }, displayOrder: 4 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'SGPT (ALT)', unit: 'U/L', inputType: 'number', referenceRange: { default: 'Upto 35' }, displayOrder: 5 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'SGOT (AST)', unit: 'U/L', inputType: 'number', referenceRange: { default: 'Upto 41' }, displayOrder: 6 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Serum Protein', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '6.0 - 8.3' }, displayOrder: 7 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Serum Albumin', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '3.5 - 5.2' }, displayOrder: 8 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Serum Globulin', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '2.5 - 3.5' }, displayOrder: 9 },
            { testId: lft.id, categoryId: lftCat.id, parameterName: 'Alb / Glo Ratio', unit: '', inputType: 'number', referenceRange: null, displayOrder: 10 },
        ],
    });
    console.log('  ✅ LFT parameters seeded');

    // =========================
    // 4. CRP - C-Reactive Protein
    // =========================
    const crp = await prisma.labTest.upsert({
        where: { code: 'CRP' },
        update: { name: 'C-Reactive Protein (CRP)', department: 'SEROLOGY', price: 400 },
        create: { code: 'CRP', name: 'C-Reactive Protein (CRP)', department: 'SEROLOGY', price: 400 },
    });
    console.log('  ✅ CRP test created/updated');

    const crpCat = await (prisma as any).labTestCategory.create({
        data: { testId: crp.id, name: 'SEROLOGY', displayOrder: 1 },
    });

    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: crp.id, categoryId: crpCat.id, parameterName: 'CRP RESULT', unit: 'mg/L', inputType: 'number', referenceRange: { default: '< 6.0' }, displayOrder: 1 },
        ],
    });
    console.log('  ✅ CRP parameters seeded');

    // =========================
    // 5. WIDAL - Widal Test
    // =========================
    const widal = await prisma.labTest.upsert({
        where: { code: 'WIDAL' },
        update: { name: 'Widal Test', department: 'SEROLOGY', price: 350 },
        create: { code: 'WIDAL', name: 'Widal Test', department: 'SEROLOGY', price: 350 },
    });
    console.log('  ✅ WIDAL test created/updated');

    const widalCat = await (prisma as any).labTestCategory.create({
        data: { testId: widal.id, name: 'SEROLOGY', displayOrder: 1 },
    });

    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Typhi O', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 1 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Typhi H', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:160' }, displayOrder: 2 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Paratyphi AH', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 3 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Paratyphi BH', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 4 },
        ],
    });
    console.log('  ✅ WIDAL parameters seeded');

    // =========================
    // 6. BACKFILL: Link existing orders to master tests
    // =========================
    console.log('\n🔗 Backfilling test_id on existing lab orders...');
    const allTests = await prisma.labTest.findMany();
    let backfillCount = 0;

    for (const test of allTests) {
        const result = await prisma.labTestOrder.updateMany({
            where: {
                testId: null,
                OR: [
                    { testCode: test.code },
                    { testName: test.name },
                    { testName: { contains: test.code, mode: 'insensitive' } },
                ],
            },
            data: { testId: test.id },
        });
        backfillCount += result.count;
    }
    console.log(`  ✅ Backfilled ${backfillCount} orders`);

    // Final summary
    const testCount = await prisma.labTest.count();
    const catCount = await (prisma as any).labTestCategory.count();
    const paramCount = await (prisma as any).labTestParameter.count();
    const linkedOrders = await prisma.labTestOrder.count({ where: { testId: { not: null } } });
    const unlinkedOrders = await prisma.labTestOrder.count({ where: { testId: null } });

    console.log(`\n📊 Summary:`);
    console.log(`  Tests:      ${testCount}`);
    console.log(`  Categories: ${catCount}`);
    console.log(`  Parameters: ${paramCount}`);
    console.log(`  Linked Orders:   ${linkedOrders}`);
    console.log(`  Unlinked Orders: ${unlinkedOrders}`);
    console.log('\n✅ Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
