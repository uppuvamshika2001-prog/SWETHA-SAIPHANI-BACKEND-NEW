import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertLabTest(prisma: any, code: string, createData: any, updateData: any) {
    const existing = await prisma.labTest.findFirst({ where: { code } });
    if (existing) {
        return await prisma.labTest.update({ where: { id: existing.id }, data: updateData });
    }
    return await prisma.labTest.create({ data: createData });
}

async function main() {
    console.log('🌱 Seeding lab test master data...');

    // First, clean out old data to avoid duplicates
    console.log('  Clearing existing lab test data...');
    await (prisma as any).labTestParameter.deleteMany({});
    await (prisma as any).labTestCategory.deleteMany({});

    // Cleanup for renamed tests to avoid duplicates
    await (prisma.labTest as any).deleteMany({
        where: { code: { in: ['DENGUE', 'XRAY'] } }
    });

    // =========================
    // 1. CBP - Complete Blood Picture (PANEL)
    // =========================
    const cbp = await upsertLabTest(prisma, 'CBP', { code: 'CBP', name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', type: 'PANEL', price: 500, isActive: true }, { name: 'Complete Blood Picture (CBP)', department: 'HEMATOLOGY', type: 'PANEL', price: 500, isActive: true });
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
    const cue = await upsertLabTest(prisma, 'CUE', { code: 'CUE', name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', type: 'PANEL', price: 300, isActive: true }, { name: 'Complete Urine Examination (CUE)', department: 'PATHOLOGY', type: 'PANEL', price: 300, isActive: true });

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
    const lft = await upsertLabTest(prisma, 'LFT', { code: 'LFT', name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200, isActive: true }, { name: 'Liver Function Test (LFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200, isActive: true });

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
    const rft = await upsertLabTest(prisma, 'RFT', { code: 'RFT', name: 'Renal Function Test (RFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1000, isActive: true }, { name: 'Renal Function Test (RFT)', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1000, isActive: true });

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
    const lipid = await upsertLabTest(prisma, 'LIPID_PROFILE', { code: 'LIPID_PROFILE', name: 'Lipid Profile', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200, isActive: true }, { name: 'Lipid Profile', department: 'BIOCHEMISTRY', type: 'PANEL', price: 1200, isActive: true });

    const lipidCat = await (prisma as any).labTestCategory.create({ data: { testId: lipid.id, name: 'LIPID PROFILE', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'Total Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 200' }, displayOrder: 1 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'HDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { male: '> 40', female: '> 50' }, displayOrder: 2 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'LDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 100' }, displayOrder: 3 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'Triglycerides', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 150' }, displayOrder: 4 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'VLDL Cholesterol', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '< 30' }, displayOrder: 5 },
            { testId: lipid.id, categoryId: lipidCat.id, parameterName: 'CHOL / HDL Ratio', unit: '', inputType: 'number', referenceRange: { default: '< 5.0' }, displayOrder: 6 },
        ]
    });

    // =========================
    // 6. Thyroid Profile (PANEL)
    // =========================
    const thyroid = await upsertLabTest(prisma, 'THYROID_PROFILE', { code: 'THYROID_PROFILE', name: 'Thyroid Profile', department: 'IMMUNOLOGY', type: 'PANEL', price: 1500, isActive: true }, { name: 'Thyroid Profile', department: 'IMMUNOLOGY', type: 'PANEL', price: 1500, isActive: true });

    const thyroidCat = await (prisma as any).labTestCategory.create({ data: { testId: thyroid.id, name: 'THYROID PROFILE', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'Total T3', unit: 'ng/dl', inputType: 'number', referenceRange: { default: '80 - 200' }, displayOrder: 1 },
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'Total T4', unit: 'ug/dl', inputType: 'number', referenceRange: { default: '5 - 12' }, displayOrder: 2 },
            { testId: thyroid.id, categoryId: thyroidCat.id, parameterName: 'TSH', unit: 'uIU/ml', inputType: 'number', referenceRange: { default: '0.4 - 4' }, displayOrder: 3 },
        ]
    });

    // =========================
    // 7. Serum Electrolytes (PANEL)
    // =========================
    const electrolytes = await upsertLabTest(prisma, 'SERUM_ELECTROLYTES', { code: 'SERUM_ELECTROLYTES', name: 'Serum Electrolytes', department: 'BIOCHEMISTRY', type: 'PANEL', price: 800, isActive: true }, { name: 'Serum Electrolytes', department: 'BIOCHEMISTRY', type: 'PANEL', price: 800, isActive: true });

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
    const widal = await upsertLabTest(prisma, 'WIDAL', { code: 'WIDAL', name: 'Widal Test', department: 'SEROLOGY', type: 'PANEL', price: 350, isActive: true }, { name: 'Widal Test', department: 'SEROLOGY', type: 'PANEL', price: 350, isActive: true });

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
    // 9. Dengue Profile (PANEL - Semi-structured)
    // =========================
    const dengue = await upsertLabTest(prisma, 'DENGUE_PROFILE', { code: 'DENGUE_PROFILE', name: 'Dengue Profile', department: 'SEROLOGY', type: 'PANEL', price: 1000, isActive: true }, { name: 'Dengue Profile', department: 'SEROLOGY', type: 'PANEL', price: 1000, isActive: true });

    const dengueCat = await (prisma as any).labTestCategory.create({ data: { testId: dengue.id, name: 'SEROLOGY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue NS1 Antigen', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 1 },
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue IgG Antibody', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 2 },
            { testId: dengue.id, categoryId: dengueCat.id, parameterName: 'Dengue IgM Antibody', unit: '', inputType: 'text', referenceRange: { default: 'Negative' }, displayOrder: 3 },
        ]
    });

    // =========================
    // ADDITIONAL SINGLE TESTS
    // =========================
    const bg = await upsertLabTest(prisma, 'BLOOD_GROUP', { code: 'BLOOD_GROUP', name: 'Blood Grouping and Typing', department: 'HEMATOLOGY', type: 'SINGLE', price: 100, isActive: true }, { name: 'Blood Grouping and Typing', department: 'HEMATOLOGY', type: 'SINGLE', price: 100, isActive: true });
    const bgCat = await (prisma as any).labTestCategory.create({ data: { testId: bg.id, name: 'HEMATOLOGY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: bg.id, categoryId: bgCat.id, parameterName: 'ABO Group', unit: '', inputType: 'text', referenceRange: { default: 'A / B / AB / O' }, displayOrder: 1 },
            { testId: bg.id, categoryId: bgCat.id, parameterName: 'Rh Factor', unit: '', inputType: 'text', referenceRange: { default: 'Positive / Negative' }, displayOrder: 2 },
        ]
    });

    const vitD3 = await upsertLabTest(prisma, 'VITAMIN_D3', { code: 'VITAMIN_D3', name: 'Vitamin D3', department: 'BIOCHEMISTRY', type: 'SINGLE', price: 1800, isActive: true }, { name: 'Vitamin D3', department: 'BIOCHEMISTRY', type: 'SINGLE', price: 1800, isActive: true });
    const vitD3Cat = await (prisma as any).labTestCategory.create({ data: { testId: vitD3.id, name: 'BIOCHEMISTRY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.create({
        data: { testId: vitD3.id, categoryId: vitD3Cat.id, parameterName: '25-OH Vitamin D', unit: 'ng/mL', inputType: 'number', referenceRange: { deficiency: '< 20', insufficient: '20 - 29', sufficient: '30 - 100', toxicity: '> 100' }, displayOrder: 1 }
    });

    const sua = await upsertLabTest(prisma, 'SERUM_URIC_ACID', { code: 'SERUM_URIC_ACID', name: 'Serum Uric Acid', department: 'BIOCHEMISTRY', type: 'SINGLE', price: 200, isActive: true }, { name: 'Serum Uric Acid', department: 'BIOCHEMISTRY', type: 'SINGLE', price: 200, isActive: true });
    const suaCat = await (prisma as any).labTestCategory.create({ data: { testId: sua.id, name: 'BIOCHEMISTRY', displayOrder: 1 } });
    await (prisma as any).labTestParameter.create({
        data: { testId: sua.id, categoryId: suaCat.id, parameterName: 'Serum Uric Acid', unit: 'mg/dL', inputType: 'number', referenceRange: { male: '3.4 - 7.0', female: '2.4 - 5.7' }, displayOrder: 1 }
    });

    // =========================
    // SINGLE TESTS
    // =========================
    console.log('  Seeding Single Tests...');

    const singleTestsRef = [
        { code: 'ESR', name: 'ESR (Erythrocyte Sedimentation Rate)', dept: 'HEMATOLOGY', price: 100, param: 'ESR', unit: 'mm/hr', range: '0 - 20', maleRange: '0-15', femaleRange: '0-20' },
        { code: 'CRP', name: 'C-Reactive Protein (CRP)', dept: 'SEROLOGY', price: 400, param: 'C-Reactive Protein', unit: 'mg/L', range: '< 6.0' },
        { code: 'HBA1C', name: 'HbA1C (Glycosylated Hemoglobin)', dept: 'BIOCHEMISTRY', price: 600, param: 'HbA1c', unit: '%', range: '4.0 - 5.6' },
        { code: 'BLOOD_UREA', name: 'Blood Urea', dept: 'BIOCHEMISTRY', price: 200, param: 'Blood Urea', unit: 'mg/dL', range: '15 - 45' },
        { code: 'SERUM_CREATININE', name: 'Serum Creatinine', dept: 'BIOCHEMISTRY', price: 250, param: 'Creatinine', unit: 'mg/dL', range: '0.6 - 1.4', maleRange: '0.7-1.3', femaleRange: '0.6-1.1' },
        { code: 'SERUM_CALCIUM', name: 'Serum Calcium', dept: 'BIOCHEMISTRY', price: 300, param: 'Serum Calcium', unit: 'mg/dl', range: '8.5 - 10.5' },
        { code: 'RBS', name: 'RBS (Random Blood Sugar)', dept: 'BIOCHEMISTRY', price: 150, param: 'Random Blood Sugar', unit: 'mg/dL', range: '70 - 140' },
        { code: 'MP', name: 'Malarial Parasite (MP)', dept: 'PATHOLOGY', price: 250, param: 'Malarial Parasite', unit: '', range: 'Negative' },
        { code: 'HIV', name: 'HIV I & II Antibodies', dept: 'SEROLOGY', price: 500, param: 'HIV Antibodies', unit: '', range: 'Negative' },
        { code: 'HBSAG', name: 'HBsAg', dept: 'SEROLOGY', price: 400, param: 'HBsAg', unit: '', range: 'Negative' },
        { code: 'HCV', name: 'Anti HCV', dept: 'SEROLOGY', price: 600, param: 'Anti HCV', unit: '', range: 'Negative' },
    ];

    for (const st of singleTestsRef) {
        const test = await upsertLabTest(prisma, st.code, { code: st.code, name: st.name, department: st.dept, type: 'SINGLE', price: st.price, isActive: true }, { name: st.name, department: st.dept, type: 'SINGLE', price: st.price, isActive: true });

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
                referenceRange: (st as any).maleRange
                    ? { default: st.range, male: (st as any).maleRange, female: (st as any).femaleRange }
                    : { default: st.range },
                displayOrder: 1
            }
        });
    }

    // =========================
    // REPORT TESTS
    // =========================
    console.log('  Seeding Report Tests...');

    await upsertLabTest(prisma, 'XRAY_CHEST_PA', { code: 'XRAY_CHEST_PA', name: 'Chest X-Ray PA View', department: 'RADIOLOGY', type: 'REPORT', price: 600, isActive: true }, { name: 'Chest X-Ray PA View', department: 'RADIOLOGY', type: 'REPORT', price: 600, isActive: true });

    await upsertLabTest(prisma, 'XRAY_KNEE_AP_LAT', { code: 'XRAY_KNEE_AP_LAT', name: 'X-Ray Knee Joint AP/LAT', department: 'RADIOLOGY', type: 'REPORT', price: 1600, isActive: true }, { name: 'X-Ray Knee Joint AP/LAT', department: 'RADIOLOGY', type: 'REPORT', price: 1600, isActive: true });

    await upsertLabTest(prisma, 'XRAY_BOTH_KNEE_AP_LAT', { code: 'XRAY_BOTH_KNEE_AP_LAT', name: 'Both Knee Joints AP/LAT', department: 'RADIOLOGY', type: 'REPORT', price: 1600, isActive: true }, { name: 'Both Knee Joints AP/LAT', department: 'RADIOLOGY', type: 'REPORT', price: 1600, isActive: true });

    // =========================
    // BT CT - Bleeding Time / Clotting Time (PANEL)
    // =========================
    const btct = await upsertLabTest(prisma, 'BT_CT', { code: 'BT_CT', name: 'BT CT', department: 'HEMATOLOGY', type: 'PANEL', price: 200, isActive: true }, { name: 'BT CT', department: 'HEMATOLOGY', type: 'PANEL', price: 200, isActive: true });
    console.log('  ✅ BT CT test created/updated');

    const btctCat = await (prisma as any).labTestCategory.create({
        data: { testId: btct.id, name: 'HEMATOLOGY', displayOrder: 1 },
    });
    await (prisma as any).labTestParameter.createMany({
        data: [
            { testId: btct.id, categoryId: btctCat.id, parameterName: 'Bleeding Time', unit: 'min', inputType: 'number', referenceRange: { default: '2 - 7' }, normalMin: 2, normalMax: 7, displayOrder: 1 },
            { testId: btct.id, categoryId: btctCat.id, parameterName: 'Clotting Time', unit: 'min', inputType: 'number', referenceRange: { default: '5 - 11' }, normalMin: 5, normalMax: 11, displayOrder: 2 },
        ]
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
