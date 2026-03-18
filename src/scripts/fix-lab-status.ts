import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: PENDING -> PAYMENT_PENDING for LabTestOrder');

  const result = await prisma.labTestOrder.updateMany({
    where: {
      status: 'PENDING' as any,
    },
    data: {
      status: 'PAYMENT_PENDING' as any,
    },
  });

  console.log(`Successfully updated ${result.count} lab orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
