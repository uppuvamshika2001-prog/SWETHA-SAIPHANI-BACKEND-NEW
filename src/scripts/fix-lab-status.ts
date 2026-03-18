import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: PENDING -> PAYMENT_PENDING for LabTestOrder');

  const count = await prisma.$executeRaw`
    UPDATE lab_test_orders 
    SET status = 'PAYMENT_PENDING'::"LabTestStatus"
    WHERE status::text = 'PENDING'
  `;

  console.log(`Successfully updated ${count} lab orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
