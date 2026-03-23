const fs = require('fs');
let code = fs.readFileSync('prisma/seed.ts', 'utf8');

const helper = `async function upsertLabTest(code: string, data: any) {
    const existing = await prisma.labTest.findFirst({ where: { code } });
    if (existing) {
        return await prisma.labTest.update({ where: { id: existing.id }, data: data.update });
    }
    return await prisma.labTest.create({ data: data.create });
}

`;

if (!code.includes('upsertLabTest(')) {
    code = code.replace('async function main() {', helper + 'async function main() {');
    code = code.replace(/await \(prisma\.labTest as any\)\.upsert\(\{\s*where:\s*\{\s*code:\s*([^}]+?)\s*\},\s*(update:[\s\S]*?create:[\s\S]*?)\}\);/g, 
      "await upsertLabTest($1, {\n        $2});");
    fs.writeFileSync('prisma/seed.ts', code);
    console.log("Replaced upserts");
} else {
    console.log("Already replaced");
}
