const fs = require('fs');
let code = fs.readFileSync('prisma/seed.ts', 'utf8');

const helper = `async function upsertLabTest(prisma: any, code: string, createData: any, updateData: any) {
    const existing = await prisma.labTest.findFirst({ where: { code } });
    if (existing) {
        return await prisma.labTest.update({ where: { id: existing.id }, data: updateData });
    }
    return await prisma.labTest.create({ data: createData });
}

`;

if (!code.includes('upsertLabTest(')) {
    code = code.replace('async function main() {', helper + 'async function main() {');
    // We need to replace prisma.labTest.upsert with our custom function
    // The previous regex was: await (prisma.labTest as any).upsert({ where: { code: 'CBP' }, update: {...}, create: {...} });
    
    code = code.replace(/await\s*\(\s*prisma\.labTest\s*as\s*any\s*\)\.upsert\(\s*\{\s*where:\s*\{\s*code:\s*([^}]+?)\s*\}\s*,\s*update:\s*([\s\S]*?)\s*,\s*create:\s*([\s\S]*?)\s*\}\s*\)/g, 
        "await upsertLabTest(prisma, $1, $3, $2)");
        
    fs.writeFileSync('prisma/seed.ts', code);
    console.log("Successfully replaced upserts with custom function");
} else {
    console.log("Already replaced");
}
