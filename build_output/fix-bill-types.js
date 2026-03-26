import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function fixBillTypes() {
    console.log('Starting billType standardization...');
    try {
        // Standardize 'consultation'
        const res1 = await prisma.bill.updateMany({
            where: { billType: 'consultation' },
            data: { billType: 'CONSULTATION' }
        });
        console.log(`Updated ${res1.count} 'consultation' bills to 'CONSULTATION'`);
        // Standardize 'pharmacy'
        const res2 = await prisma.bill.updateMany({
            where: { billType: 'pharmacy' },
            data: { billType: 'PHARMACY' }
        });
        console.log(`Updated ${res2.count} 'pharmacy' bills to 'PHARMACY'`);
        // Standardize 'lab'
        const res3 = await prisma.bill.updateMany({
            where: { billType: 'lab' },
            data: { billType: 'LAB' }
        });
        console.log(`Updated ${res3.count} 'lab' bills to 'LAB'`);
    }
    catch (error) {
        console.error('Error standardizing bill types:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
fixBillTypes();
//# sourceMappingURL=fix-bill-types.js.map