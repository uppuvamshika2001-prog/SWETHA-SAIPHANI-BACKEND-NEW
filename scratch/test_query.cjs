const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT m.name, m.price_per_unit as med_unit_price, m.pack_quantity as med_pack_qty, 
           mb.selling_price as batch_price, mb.pack_quantity as batch_pack_qty, mb.stock_quantity
    FROM medicines m 
    LEFT JOIN medicine_batches mb ON mb.medicine_id::text = m.id::text 
    WHERE m.name ILIKE '%dolo%'
  `);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
