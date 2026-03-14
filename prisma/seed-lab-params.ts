import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Lab Test Parameters...');

  // 1. Find or create the tests
  const tests = [
    { code: 'CBC', name: 'Complete Blood Picture', department: 'HEMATOLOGY' },
    { code: 'LFT', name: 'Liver Function Test', department: 'BIOCHEMISTRY' },
    { code: 'CRP', name: 'C-Reactive Protein', department: 'SEROLOGY' },
    { code: 'WIDAL', name: 'Widal Test', department: 'SEROLOGY' },
    { code: 'URINE', name: 'Urine Examination', department: 'PATHOLOGY' },
  ];

  for (const t of tests) {
    let test = await prisma.labTest.upsert({
      where: { code: t.code },
      update: { department: t.department, name: t.name },
      create: {
        code: t.code,
        name: t.name,
        department: t.department,
        price: 500,
      },
    });

    console.log(`Processing test: ${t.name} (${t.code})`);

    // Define parameters for each test
    let params: any[] = [];

    if (t.code === 'CBC') {
      params = [
        { name: 'Hemoglobin', unit: 'g/dL', min: 12.5, max: 17.5, range: '12.5-17.5', order: 1 },
        { name: 'RBC Count', unit: 'Millions/cumm', min: 4.0, max: 6.2, range: '4.0-6.2', order: 2 },
        { name: 'PCV', unit: '%', min: 37, max: 54, range: '37-54', order: 3 },
        { name: 'WBC Count', unit: '/cumm', min: 4000, max: 10000, range: '4000-10000', order: 4 },
        { name: 'Neutrophils', unit: '%', min: 40, max: 75, range: '40-75', order: 5 },
        { name: 'Lymphocytes', unit: '%', min: 20, max: 40, range: '20-40', order: 6 },
        { name: 'Eosinophils', unit: '%', min: 1, max: 6, range: '1-6', order: 7 },
        { name: 'Monocytes', unit: '%', min: 2, max: 10, range: '2-10', order: 8 },
        { name: 'Basophils', unit: '%', min: 0, max: 1, range: '0-1', order: 9 },
        { name: 'Platelet Count', unit: 'Lakhs/cumm', min: 1.5, max: 4.5, range: '1.5-4.5', order: 10 },
        { name: 'Peripheral Smear - RBC', unit: '', min: null, max: null, range: 'Normal', order: 11 },
        { name: 'Peripheral Smear - WBC', unit: '', min: null, max: null, range: 'Normal', order: 12 },
        { name: 'Peripheral Smear - Platelets', unit: '', min: null, max: null, range: 'Normal', order: 13 },
      ];
    } else if (t.code === 'LFT') {
      params = [
        { name: 'Bilirubin Total', unit: 'mg/dl', min: 0.1, max: 1.2, range: '0.1-1.2', order: 1 },
        { name: 'Bilirubin Direct', unit: 'mg/dl', min: 0, max: 0.3, range: 'up to 0.3', order: 2 },
        { name: 'Bilirubin Indirect', unit: 'mg/dl', min: 0.3, max: 1.0, range: '0.3-1.0', order: 3 },
        { name: 'Alkaline Phosphatase', unit: 'U/L', min: 30, max: 120, range: '30-120', order: 4 },
        { name: 'SGPT (ALT)', unit: 'U/L', min: 0, max: 35, range: 'up to 35', order: 5 },
        { name: 'SGOT (AST)', unit: 'U/L', min: 0, max: 41, range: 'up to 41', order: 6 },
        { name: 'Serum Protein', unit: 'gm/dl', min: 6.0, max: 8.3, range: '6.0-8.3', order: 7 },
        { name: 'Serum Albumin', unit: 'gm/dl', min: 3.5, max: 5.2, range: '3.5-5.2', order: 8 },
        { name: 'Serum Globulin', unit: 'gm/dl', min: 2.5, max: 3.5, range: '2.5-3.5', order: 9 },
        { name: 'Alb/Glob Ratio', unit: '', min: 1.1, max: 2.2, range: '1.1-2.2', order: 10 },
      ];
    } else if (t.code === 'CRP') {
      params = [
        { name: 'CRP Result', unit: 'mg/L', min: 0, max: 6.0, range: '< 6.0', order: 1 },
      ];
    } else if (t.code === 'WIDAL') {
      params = [
        { name: 'Salmonella typhi O Antigen', unit: 'Titre', min: null, max: null, range: '< 1:80', order: 1 },
        { name: 'Salmonella typhi H Antigen', unit: 'Titre', min: null, max: null, range: '< 1:80', order: 2 },
        { name: 'Salmonella paratyphi AH Antigen', unit: 'Titre', min: null, max: null, range: '< 1:80', order: 3 },
        { name: 'Salmonella paratyphi BH Antigen', unit: 'Titre', min: null, max: null, range: '< 1:80', order: 4 },
      ];
    } else if (t.code === 'URINE') {
      params = [
        { name: 'Colour', unit: '', min: null, max: null, range: 'Pale Yellow', order: 1 },
        { name: 'Appearance', unit: '', min: null, max: null, range: 'Clear', order: 2 },
        { name: 'pH', unit: '', min: 4.5, max: 8.0, range: '4.5-8.0', order: 3 },
        { name: 'Specific Gravity', unit: '', min: 1.005, max: 1.030, range: '1.005-1.030', order: 4 },
        { name: 'Protein (Albumin)', unit: '', min: null, max: null, range: 'Negative', order: 5 },
        { name: 'Sugar (Glucose)', unit: '', min: null, max: null, range: 'Negative', order: 6 },
        { name: 'Ketone Bodies', unit: '', min: null, max: null, range: 'Negative', order: 7 },
        { name: 'Bile Salts', unit: '', min: null, max: null, range: 'Negative', order: 8 },
        { name: 'Bile Pigments', unit: '', min: null, max: null, range: 'Negative', order: 9 },
        { name: 'Urobilinogen', unit: '', min: null, max: null, range: 'Normal', order: 10 },
        { name: 'RBC (Microscopic)', unit: '/hpf', min: 0, max: 2, range: '0-2', order: 11 },
        { name: 'Pus Cells', unit: '/hpf', min: 0, max: 5, range: '0-5', order: 12 },
        { name: 'Epithelial Cells', unit: '/hpf', min: 0, max: 5, range: '0-5', order: 13 },
        { name: 'Casts', unit: '', min: null, max: null, range: 'Nil', order: 14 },
        { name: 'Crystals', unit: '', min: null, max: null, range: 'Nil', order: 15 },
        { name: 'Mucus', unit: '', min: null, max: null, range: 'Nil', order: 16 },
      ];
    }

    for (const p of params) {
      await (prisma as any).labTestParameter.upsert({
        where: { id: `${test.id}-${p.name}` },
        update: {
          parameterName: p.name,
          unit: p.unit,
          normalMin: p.min,
          normalMax: p.max,
          normalRange: p.range,
          displayOrder: p.order,
        },
        create: {
          id: `${test.id}-${p.name}`, // Fixed ID for upsert consistency
          testId: test.id,
          parameterName: p.name,
          unit: p.unit,
          normalMin: p.min,
          normalMax: p.max,
          normalRange: p.range,
          displayOrder: p.order,
        }
      });
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
