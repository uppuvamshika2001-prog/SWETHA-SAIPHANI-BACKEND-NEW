import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting master lab data seed...');

    const tests = [
        {
            code: 'CBP',
            name: 'Complete Blood Picture (CBP)',
            department: 'HEAMATOLOGY',
            price: 500,
            categories: [
                {
                    name: 'HEAMATOLOGY',
                    displayOrder: 1,
                    parameters: [
                        { name: 'Hemoglobin', unit: 'gm%', inputType: 'number', referenceRange: { male: '13.5 - 17.5', female: '12.5 - 16.5' }, displayOrder: 1 },
                        { name: 'Total Erythrocyte Count (RBC)', unit: 'Millions/cumm', inputType: 'number', referenceRange: { default: '4.0 - 6.2' }, displayOrder: 2 },
                        { name: 'Packed Cell Volume (PCV)', unit: '%', inputType: 'number', referenceRange: { default: '37 - 54' }, displayOrder: 3 },
                        { name: 'Total Leucocyte Count (WBC)', unit: '/cumm', inputType: 'number', referenceRange: { default: '4,000 - 10,000' }, displayOrder: 4 },
                    ]
                },
                {
                    name: 'DIFFERENTIAL COUNT',
                    displayOrder: 2,
                    parameters: [
                        { name: 'Neutrophils', unit: '%', inputType: 'number', referenceRange: { default: '40 - 75' }, displayOrder: 1 },
                        { name: 'Lymphocytes', unit: '%', inputType: 'number', referenceRange: { default: '20 - 40' }, displayOrder: 2 },
                        { name: 'Eosinophils', unit: '%', inputType: 'number', referenceRange: { default: '1 - 6' }, displayOrder: 3 },
                        { name: 'Monocytes', unit: '%', inputType: 'number', referenceRange: { default: '2 - 10' }, displayOrder: 4 },
                        { name: 'Basophils', unit: '%', inputType: 'number', referenceRange: { default: '0 - 1' }, displayOrder: 5 },
                        { name: 'Platelet Count', unit: 'Lakhs/cumm', inputType: 'number', referenceRange: { default: '1.5 - 4.5' }, displayOrder: 6 },
                    ]
                },
                {
                    name: 'PERIPHERAL SMEAR',
                    displayOrder: 3,
                    parameters: [
                        { name: 'RBC', unit: '', inputType: 'text', referenceRange: null, displayOrder: 1 },
                        { name: 'WBC', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
                        { name: 'Platelets', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
                    ]
                }
            ]
        },
        {
            code: 'LFT',
            name: 'Liver Function Test (LFT)',
            department: 'BIO CHEMISTRY',
            price: 1200,
            categories: [
                {
                    name: 'BIO CHEMISTRY',
                    displayOrder: 1,
                    parameters: [
                        { name: 'Bilirubin Total', unit: 'mg/dl', inputType: 'number', referenceRange: { adults: '0.1 - 1.2', newborn: '0.1 - 12.6' }, displayOrder: 1 },
                        { name: 'Bilirubin Direct', unit: 'mg/dl', inputType: 'number', referenceRange: { default: 'Upto 0.3' }, displayOrder: 2 },
                        { name: 'Bilirubin Indirect', unit: 'mg/dl', inputType: 'number', referenceRange: { default: '0.3 - 1.0' }, displayOrder: 3 },
                        { name: 'Alkaline Phosphatase', unit: 'U/L', inputType: 'number', referenceRange: { adults: '53 - 141', '1m-9y': '82 - 383', '10y-15y': '42 - 390', '16y-18y': '52 - 171' }, displayOrder: 4 },
                        { name: 'SGPT', unit: 'U/L', inputType: 'number', referenceRange: { default: 'Upto 35' }, displayOrder: 5 },
                        { name: 'SGOT', unit: 'U/L', inputType: 'number', referenceRange: { default: 'Upto 41' }, displayOrder: 6 },
                        { name: 'Serum Protein', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '6.0 - 8.3' }, displayOrder: 7 },
                        { name: 'Serum Albumin', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '3.5 - 5.2' }, displayOrder: 8 },
                        { name: 'Serum Globulin', unit: 'gm/dl', inputType: 'number', referenceRange: { default: '2.5 - 3.5' }, displayOrder: 9 },
                        { name: 'Alb / Glo Ratio', unit: '', inputType: 'number', referenceRange: null, displayOrder: 10 },
                    ]
                }
            ]
        },
        {
            code: 'CUE',
            name: 'Complete Urine Examination (CUE)',
            department: 'PATHOLOGY',
            price: 300,
            categories: [
                {
                    name: 'PHYSICAL EXAMINATION',
                    displayOrder: 1,
                    parameters: [
                        { name: 'Quantity', unit: 'ml', inputType: 'number', referenceRange: null, displayOrder: 1 },
                        { name: 'Colour', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
                        { name: 'Appearance', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
                        { name: 'Reaction (pH)', unit: '', inputType: 'number', referenceRange: { default: '5.0 - 7.0' }, displayOrder: 4 },
                        { name: 'Specific Gravity', unit: '', inputType: 'number', referenceRange: { default: '1.005 - 1.025' }, displayOrder: 5 },
                    ]
                },
                {
                    name: 'CHEMICAL EXAMINATION',
                    displayOrder: 2,
                    parameters: [
                        { name: 'Proteins', unit: '', inputType: 'text', referenceRange: null, displayOrder: 1 },
                        { name: 'Sugar', unit: '', inputType: 'text', referenceRange: null, displayOrder: 2 },
                        { name: 'Ketone Bodies', unit: '', inputType: 'text', referenceRange: null, displayOrder: 3 },
                        { name: 'Bile Salts & Bile Pigments', unit: '', inputType: 'text', referenceRange: null, displayOrder: 4 },
                        { name: 'Urobilinogen', unit: '', inputType: 'text', referenceRange: null, displayOrder: 5 },
                    ]
                },
                {
                    name: 'MICROSCOPIC EXAMINATION',
                    displayOrder: 3,
                    parameters: [
                        { name: 'R.B.C', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 1 },
                        { name: 'Pus (WBC) Cells', unit: '/HPF', inputType: 'text', referenceRange: null, displayOrder: 2 },
                        { name: 'Epithelial Cells', unit: '/HPF', inputType: 'text', referenceRange: null, displayOrder: 3 },
                        { name: 'Casts', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 4 },
                        { name: 'Crystals', unit: '/HPF', inputType: 'text', referenceRange: { default: 'Nil' }, displayOrder: 5 },
                        { name: 'Others', unit: '', inputType: 'text', referenceRange: null, displayOrder: 6 },
                        { name: 'Mucus', unit: '', inputType: 'text', referenceRange: null, displayOrder: 7 },
                    ]
                }
            ]
        },
        {
            code: 'CRP',
            name: 'C-Reactive Protein (CRP)',
            department: 'SEROLOGY',
            price: 400,
            categories: [
                {
                    name: 'SEROLOGY',
                    displayOrder: 1,
                    parameters: [
                        { name: 'CRP RESULT', unit: 'mg/l', inputType: 'number', referenceRange: { default: '< 6.0' }, displayOrder: 1 },
                    ]
                }
            ]
        },
        {
            code: 'WIDAL',
            name: 'Widal Test',
            department: 'SEROLOGY',
            price: 350,
            categories: [
                {
                    name: 'SEROLOGY',
                    displayOrder: 1,
                    parameters: [
                        { name: 'Salmonella Typhi O', unit: 'Titre', inputType: 'select', options: ['< 1:20', '1:20', '1:40', '1:80', '1:160', '1:320+'], referenceRange: { default: '< 1:80' }, displayOrder: 1 },
                        { name: 'Salmonella Typhi H', unit: 'Titre', inputType: 'select', options: ['< 1:20', '1:20', '1:40', '1:80', '1:160', '1:320+'], referenceRange: { default: '< 1:160' }, displayOrder: 2 },
                        { name: 'Salmonella Paratyphi AH', unit: 'Titre', inputType: 'select', options: ['< 1:20', '1:20', '1:40', '1:80', '1:160', '1:320+'], referenceRange: { default: '< 1:80' }, displayOrder: 3 },
                        { name: 'Salmonella Paratyphi BH', unit: 'Titre', inputType: 'select', options: ['< 1:20', '1:20', '1:40', '1:80', '1:160', '1:320+'], referenceRange: { default: '< 1:80' }, displayOrder: 4 },
                    ]
                }
            ]
        }
    ];

    for (const testData of tests) {
        console.log(`Processing test: ${testData.name}`);
        
        const test = await prisma.labTest.upsert({
            where: { code: testData.code },
            update: {
                name: testData.name,
                department: testData.department,
                price: testData.price,
            },
            create: {
                code: testData.code,
                name: testData.name,
                department: testData.department,
                price: testData.price,
            },
        });

        for (const catData of testData.categories) {
            const category = await (prisma as any).labTestCategory.upsert({
                where: {
                    // We need a way to identify the category. Since there's no unique constaint in schema, 
                    // we'll find first by testId and name.
                    id: (await (prisma as any).labTestCategory.findFirst({
                        where: { testId: test.id, name: catData.name }
                    }))?.id || '00000000-0000-0000-0000-000000000000',
                },
                update: {
                    displayOrder: catData.displayOrder,
                },
                create: {
                    testId: test.id,
                    name: catData.name,
                    displayOrder: catData.displayOrder,
                },
            });

            for (const pData of catData.parameters) {
                await (prisma as any).labTestParameter.upsert({
                    where: {
                        id: (await (prisma as any).labTestParameter.findFirst({
                            where: { testId: test.id, parameterName: pData.name }
                        }))?.id || '00000000-0000-0000-0000-000000000000',
                    },
                    update: {
                        categoryId: category.id,
                        unit: pData.unit,
                        inputType: pData.inputType,
                        referenceRange: pData.referenceRange,
                        options: (pData as any).options || null,
                        displayOrder: pData.displayOrder,
                    },
                    create: {
                        testId: test.id,
                        categoryId: category.id,
                        parameterName: pData.name,
                        unit: pData.unit,
                        inputType: pData.inputType,
                        referenceRange: pData.referenceRange,
                        options: (pData as any).options || null,
                        displayOrder: pData.displayOrder,
                    },
                });
            }
        }
    }

    console.log('Master data seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
