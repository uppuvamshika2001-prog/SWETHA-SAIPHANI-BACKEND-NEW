import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding lab test master data...');

    // First, clean out old data to avoid duplicates
    console.log('  Clearing existing lab test data...');
    await (prisma as any).labTestParameter.deleteMany({});
    await (prisma as any).labTestCategory.deleteMany({});

    // =========================
    // 1. CBP - Complete Blood Picture (PANEL)
    // =========================
    const cbp = await (prisma.labTest as any).upsert({
        where: { code: 'CBP' },
        update: { name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', type: 'PANEL', price: 500 },
        create: { code: 'CBP', name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', type: 'PANEL', price: 500 },
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

    // =========================
    // 2. CUE - Complete Urine Examination (PANEL)
    // =========================
    const cue = await (prisma.labTest as any).upsert({
        where: { code: 'CUE' },
        update: { name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', type: 'PANEL', price: 300 },
        create: { code: 'CUE', name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', type: 'PANEL', price: 300 },
    });
    
    const cuePhys = await (prisma as any).labTestCategory.create({ data: { testId: cue.id, name: 'PHYSICAL EXAMINATION', displayOrder: 1 } });
    const cueChem = await (prisma as any).labTestCategory.create({ data: { testId: cue.id, name: 'CHEMICAL EXAMINATION', displayOrder: 2 } });
    const cueMicro = await (prisma as any).labTestCategory.create({ data: { testId: cue.id, name: 'MICROSCOPIC EXAMINATION', displayOrder: 3 } });

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
        ]
    });

    // =========================
    // 3. LFT - Liver Function Test (PANEL)
    // =========================
    const lft = await (prisma.labTest as any).upsert({
        where: { code: 'LFT' },
        update: { name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200 },
        create: { code: 'LFT', name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200 },
    });
    
    const lftCat = await (prisma as any).labTestCategory.create({ data: { testId: lft.id, name: 'BIO CHEMISTRY', displayOrder: 1 } });
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
        ]
    });

    // =========================
    // 4. RFT - Renal Function Test (PANEL)
    // =========================
    const rft = await (prisma.labTest as any).upsert({
        where: { code: 'RFT' },
        update: { name: 'Renal Function Test (RFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1000 },
        create: { code: 'RFT', name: 'Renal Function Test (RFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1000 },
    });
    
    const rftCat = await (prisma as any).labTestCategory.create({ data: { testId: rft.id, name: 'BIO CHEMISTRY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: rft.id, categoryId: rftCat.id, parameterName: 'Blood Urea', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '15 - 45' }, displayOrder: 1 },
            { testId: rft.id, categoryId: rftCat.id, parameterName: 'Serum Creatinine', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '0.6 - 1.4' }, displayOrder: 2 },
            { testId: rft.id, categoryId: rftCat.id, parameterName: 'Serum Uric Acid', unit: 'mg/dl', inputType: 'number', referenceRange: { male: '3.4 - 7.0', female: '2.4 - 5.7' }, displayOrder: 3 },
            { testId: rft.id, categoryId: rftCat.id, parameterName: 'BUN', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '7 - 20' }, displayOrder: 4 },
        ]
    });

    // =========================
    // 5. Lipid Profile (PANEL)
    // =========================
    const lipid = await (prisma.labTest as any).upsert({
        where: { code: 'LIPID_PROFILE' },
        update: { name: 'Lipid Profile', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200 },
        create: { code: 'LIPID_PROFILE', name: 'Lipid Profile', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200 },
    });
    
    const lipidCat = await (prisma as any).labTestCategory.create({ data: { testId: lipid.id, name: 'LIPID PROFILE', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'Total Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 200' }, displayOrder: 1 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'Triglycerides', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 150' }, displayOrder: 2 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'HDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '> 40' }, displayOrder: 3 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'LDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 100' }, displayOrder: 4 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'VLDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 30' }, displayOrder: 5 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'CHOL / HDL Ratio', unit: '', inputType: 'number', referenceRange: { default: '< 5.0' }, displayOrder: 6 },
        ]
    });

    // =========================
    // 6. Thyroid Profile (PANEL)
    // =========================
    const thyroid = await (prisma.labTest as any).upsert({
        where: { code: 'THYROID_PROFILE' },
        update: { name: 'Thyroid Profile', department: 'IMMUNOLOGY', type: 'PANEL', price: 1500 },
        create: { code: 'THYROID_PROFILE', name: 'Thyroid Profile', department: 'IMMUNOLOGY', type: 'PANEL', price: 1500 },
    });
    
    const thyroidCat = await (prisma as any).labTestCategory.create({ data: { testId: thyroid.id, name: 'THYROID PROFILE', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'Total T3', unit: 'ng/dl', inputType: 'number', referenceRange: { default: '84 - 202' }, displayOrder: 1 },
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'Total T4', unit: 'ug/dl', inputType: 'number', referenceRange: { default: '5.1 - 14.1' }, displayOrder: 2 },
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'TSH', unit: 'uIU/ml', inputType: 'number', referenceRange: { default: '0.27 - 4.2' }, displayOrder: 3 },
        ]
    });

    // =========================
    // 7. Serum Electrolytes (PANEL)
    // =========================
    const electrolytes = await (prisma.labTest as any).upsert({
        where: { code: 'SERUM_ELECTROLYTES' },
        update: { name: 'Serum Electrolytes', department: 'BIOCHEMISTRY', type: 'PANEL', price: 800 },
        create: { code: 'SERUM_ELECTROLYTES', name: 'Serum Electrolytes', department: 'BIOCHEMISTRY', type: 'PANEL', price: 800 },
    });
    
    const electrolytesCat = await (prisma as any).labTestCategory.create({ data: { testId: electrolytes.id, name: 'SERUM ELECTROLYTES', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: electrolytes.id, categoryId: electrolytesCat.id, parameterName: 'Sodium (Na+)', unit: 'mEq/L', inputType: 'number', referenceRange: { default: '135 - 145' }, displayOrder: 1 },
            { testId: electrolytes.id, categoryId: electrolytesCat.id, parameterName: 'Potassium (K+)', unit: 'mEq/L', inputType: 'number', referenceRange: { default: '3.5 - 5.0' }, displayOrder: 2 },
            { testId: electrolytes.id, categoryId: electrolytesCat.id, parameterName: 'Chloride (Cl-)', unit: 'mEq/L', inputType: 'number', referenceRange: { default: '98 - 107' }, displayOrder: 3 },
        ]
    });

    // =========================
    // 8. Widal Test (PANEL)
    // =========================
    const widal = await (prisma.labTest as any).upsert({
        where: { code: 'WIDAL' },
        update: { name: 'Widal Test', department: 'SEROLOGY', type: 'PANEL', price: 350 },
        create: { code: 'WIDAL', name: 'Widal Test', department: 'SEROLOGY', type: 'PANEL', price: 350 },
    });
    
    const widalCat = await (prisma as any).labTestCategory.create({ data: { testId: widal.id, name: 'SEROLOGY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Typhi O', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 1 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Typhi H', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:160' }, displayOrder: 2 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Paratyphi AH', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 3 },
            { testId: widal.id, categoryId: widalCat.id, parameterName: 'Salmonella Paratyphi BH', unit: 'Titre', inputType: 'text', referenceRange: { default: '< 1:80' }, displayOrder: 4 },
        ]
    });

    // =========================
    // 9. Dengue (PANEL - Semi-structured)
    // =========================
    const dengue = await (prisma.labTest as any).upsert({
        where: { code: 'DENGUE' },
        update: { name: 'Dengue NS1 & Antibodies', department: 'SEROLOGY', type: 'PANEL', price: 1000 },
        create: { code: 'DENGUE', name: 'Dengue NS1 & Antibodies', department: 'SEROLOGY', type: 'PANEL', price: 1000 },
    });
    
    const dengueCat = await (prisma as any).labTestCategory.create({ data: { testId: dengue.id, name: 'SEROLOGY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue NS1 Antigen', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 1 },
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue IgG Antibody', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 2 },
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue IgM Antibody', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 3 },
        ]
    });

    // =========================
    // SINGLE TESTS
    // =========================
    console.log('  Seeding Single Tests...');
    
    const singleTestsRef = [
        { code: 'CRP', name: 'C-Reactive Protein (CRP)', dept: 'SEROLOGY', price: 400, param: 'CRP RESULT', unit: 'mg/L', range: '< 6.0' },
        { code: 'HBA1C', name: 'HbA1C (Glycosylated Hemoglobin)', dept: 'BIOCHEMISTRY', price: 600, param: 'HbA1C', unit: '%', range: '4.0 - 5.6' },
        { code: 'BLOOD_UREA', name: 'Blood Urea', dept: 'BIOCHEMISTRY', price: 200, param: 'Blood Urea', unit: 'mg/dl', range: '15 - 45' },
        { code: 'SERUM_CREATININE', name: 'Serum Creatinine', dept: 'BIOCHEMISTRY', price: 250, param: 'Serum Creatinine', unit: 'mg/dl', range: '0.6 - 1.4' },
        { code: 'SERUM_CALCIUM', name: 'Serum Calcium', dept: 'BIOCHEMISTRY', price: 300, param: 'Serum Calcium', unit: 'mg/dl', range: '8.5 - 10.5' },
        { code: 'RBS', name: 'RBS (Random Blood Sugar)', dept: 'BIOCHEMISTRY', price: 150, param: 'RBS', unit: 'mg/dl', range: '70 - 140' },
        { code: 'MP', name: 'Malarial Parasite (MP)', dept: 'PATHOLOGY', price: 250, param: 'Malarial Parasite', unit: '', range: 'Negative' },
        { code: 'HIV', name: 'HIV I & II Antibodies', dept: 'SEROLOGY', price: 500, param: 'HIV Antibodies', unit: '', range: 'Negative' },
        { code: 'HBSAG', name: 'HBsAg', dept: 'SEROLOGY', price: 400, param: 'HBsAg', unit: '', range: 'Negative' },
        { code: 'HCV', name: 'Anti HCV', dept: 'SEROLOGY', price: 600, param: 'Anti HCV', unit: '', range: 'Negative' },
    ];

    for (const st of singleTestsRef) {
        const test = await (prisma.labTest as any).upsert({
            where: { code: st.code },
            update: { name: st.name, department: st.dept, type: 'SINGLE', price: st.price },
            create: { code: st.code, name: st.name, department: st.dept, type: 'SINGLE', price: st.price },
        });

        // Although SINGLE, we store the parameter at the root level so the UI has the metadata
        // A dummy category is required by the Prisma schema (if the relation is required) although we can link directly
        // Waiting, parameter schema requires category.
        const cat = await (prisma as any).labTestCategory.create({
            data: { testId: test.id, name: 'General', displayOrder: 1 },
        });

        await (prisma as any).labTestParameter.create({
            data: { 
                testId: test.id, 
                categoryId: cat.id, 
                parameterName: st.param, 
                unit: st.unit, 
                inputType: st.range === 'Negative' ? 'text' : 'number', 
                referenceRange: { default: st.range }, 
                displayOrder: 1 
            }
        });
    }

    // =========================
    // REPORT TESTS
    // =========================
    console.log('  Seeding Report Tests...');
    
    await (prisma.labTest as any).upsert({
        where: { code: 'XRAY' },
        update: { name: 'Chest X-Ray', department: 'RADIOLOGY', type: 'REPORT', price: 500 },
        create: { code: 'XRAY', name: 'Chest X-Ray', department: 'RADIOLOGY', type: 'REPORT', price: 500 },
    });

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
                    { testCode: { equals: test.code, mode: 'insensitive' } },
                    { testName: { equals: test.name, mode: 'insensitive' } },
                    { testName: { equals: test.code, mode: 'insensitive' } },
                    { testName: { contains: test.code, mode: 'insensitive' } }
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
    const linkedOrders = await prisma.labTestOrder.count({ 
        where: { 
            NOT: [
                { testId: null },
                { testId: '' },
                { testId: 'undefined' }
            ]
        } 
    });
    const unlinkedOrders = await prisma.labTestOrder.count({ 
        where: { 
            OR: [
                { testId: null },
                { testId: '' },
                { testId: 'undefined' }
            ]
        } 
    });

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
