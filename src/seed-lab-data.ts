import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed for lab tests and parameters...');

    const tests = [
        {
            name: 'Complete Blood Picture (CBP)',
            code: 'CBP',
            department: 'Hematology',
            price: 500,
            turnaround: '24 hrs',
            parameters: [
                { name: 'Hemoglobin', unit: 'gm/dL', male: '13.5 - 17.5', female: '12.0 - 15.5', order: 1 },
                { name: 'Total RBC', unit: 'million/cumm', male: '4.5 - 5.5', female: '3.8 - 4.8', order: 2 },
                { name: 'PCV', unit: '%', male: '40 - 50', female: '36 - 46', order: 3 },
                { name: 'Total WBC', unit: '/cumm', general: '4000 - 11000', order: 4 },
                { name: 'Neutrophils', unit: '%', general: '40 - 75', order: 5 },
                { name: 'Lymphocytes', unit: '%', general: '20 - 45', order: 6 },
                { name: 'Eosinophils', unit: '%', general: '01 - 06', order: 7 },
                { name: 'Monocytes', unit: '%', general: '02 - 10', order: 8 },
                { name: 'Basophils', unit: '%', general: '00 - 01', order: 9 },
                { name: 'Platelet Count', unit: 'lakhs/cumm', general: '1.5 - 4.5', order: 10 },
            ]
        },
        {
            name: 'Liver Function Test (LFT)',
            code: 'LFT',
            department: 'Biochemistry',
            price: 1200,
            turnaround: '24 hrs',
            parameters: [
                { name: 'Bilirubin Total', unit: 'mg/dL', general: '0.2 - 1.2', order: 1 },
                { name: 'Bilirubin Direct', unit: 'mg/dL', general: '0.0 - 0.3', order: 2 },
                { name: 'Bilirubin Indirect', unit: 'mg/dL', general: '0.2 - 0.8', order: 3 },
                { name: 'Alkaline Phosphatase', unit: 'U/L', general: '30 - 120', order: 4 },
                { name: 'SGPT (ALT)', unit: 'U/L', general: '0 - 45', order: 5 },
                { name: 'SGOT (AST)', unit: 'U/L', general: '0 - 40', order: 6 },
                { name: 'Serum Protein', unit: 'gm/dL', general: '6.0 - 8.3', order: 7 },
                { name: 'Serum Albumin', unit: 'gm/dL', general: '3.5 - 5.2', order: 8 },
                { name: 'Serum Globulin', unit: 'gm/dL', general: '2.3 - 3.5', order: 9 },
                { name: 'A/G Ratio', unit: '', general: '1.1 - 2.2', order: 10 },
            ]
        },
        {
            name: 'Urine Examination (CUE)',
            code: 'CUE',
            department: 'Pathology',
            price: 300,
            turnaround: '12 hrs',
            parameters: [
                { name: 'Colour', unit: '', general: 'Pale Yellow', order: 1 },
                { name: 'Appearance', unit: '', general: 'Clear', order: 2 },
                { name: 'pH', unit: '', general: '5.0 - 8.0', order: 3 },
                { name: 'Specific Gravity', unit: '', general: '1.005 - 1.030', order: 4 },
                { name: 'Protein', unit: '', general: 'Nil', order: 5 },
                { name: 'Sugar', unit: '', general: 'Nil', order: 6 },
                { name: 'Ketone Bodies', unit: '', general: 'Nil', order: 7 },
                { name: 'Bile Pigments', unit: '', general: 'Nil', order: 8 },
                { name: 'Pus Cells', unit: '/hpf', general: '0 - 2', order: 9 },
                { name: 'Epithelial Cells', unit: '/hpf', general: '2 - 4', order: 10 },
            ]
        },
        {
            name: 'Serum Electrolytes',
            code: 'ELECTROLYTES',
            department: 'Biochemistry',
            price: 800,
            turnaround: '12 hrs',
            parameters: [
                { name: 'Serum Sodium', unit: 'mmol/L', general: '135 - 145', order: 1 },
                { name: 'Serum Potassium', unit: 'mmol/L', general: '3.5 - 5.1', order: 2 },
                { name: 'Serum Chloride', unit: 'mmol/L', general: '98 - 107', order: 3 },
            ]
        },
        {
            name: 'Blood Sugar (F & PL)',
            code: 'GLUCOSE',
            department: 'Biochemistry',
            price: 200,
            turnaround: '12 hrs',
            parameters: [
                { name: 'Fasting Blood Sugar', unit: 'mg/dL', general: '70 - 100', order: 1 },
                { name: 'Post Lunch Blood Sugar', unit: 'mg/dL', general: '110 - 140', order: 2 },
            ]
        }
    ];

    for (const testData of tests) {
        const test = await prisma.labTest.upsert({
            where: { code: testData.code },
            update: {
                name: testData.name,
                department: testData.department,
                price: testData.price,
                turnaround: testData.turnaround,
            },
            create: {
                code: testData.code,
                name: testData.name,
                department: testData.department,
                price: testData.price,
                turnaround: testData.turnaround,
            },
        });

        console.log(`Working on parameters for: ${testData.name}`);

        for (const p of testData.parameters) {
            await (prisma as any).labTestParameter.upsert({
                where: {
                    // This is a bit tricky since we don't have a unique constraint on name + testId in schema
                    // For seeding, we'll try to find by name and testId if possible, or just create
                    id: (await (prisma as any).labTestParameter.findFirst({
                        where: { testId: test.id, parameterName: p.name }
                    }))?.id || '00000000-0000-0000-0000-000000000000',
                },
                update: {
                    unit: p.unit,
                    referenceRangeMale: p.male || null,
                    referenceRangeFemale: p.female || null,
                    normalRange: p.general || null,
                    displayOrder: p.order,
                },
                create: {
                    testId: test.id,
                    parameterName: p.name,
                    unit: p.unit,
                    referenceRangeMale: p.male || null,
                    referenceRangeFemale: p.female || null,
                    normalRange: p.general || null,
                    displayOrder: p.order,
                },
            });
        }
    }

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
