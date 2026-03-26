import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const result = await prisma.labTestOrder.groupBy({
        by: ['status'],
        _count: {
            id: true,
        },
    });
    console.log('Current lab order status counts:');
    console.log(JSON.stringify(result, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=check-lab-status.js.map