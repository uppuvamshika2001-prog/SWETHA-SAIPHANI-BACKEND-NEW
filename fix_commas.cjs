const fs = require('fs');
let code = fs.readFileSync('prisma/seed.ts', 'utf8');
code = code.replace(/,, {/g, ', {');
fs.writeFileSync('prisma/seed.ts', code);
console.log('Fixed double commas');
