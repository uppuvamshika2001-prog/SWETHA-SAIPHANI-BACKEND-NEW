import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function backfillProfit() {
    console.log('Starting profit backfill...');
    try {
        // 1. Fetch all bill items where profit might be missing (currently 0)
        // and which are linked to a medicine
        const billItems = await prisma.billItem.findMany({
            where: {
                medicineId: { not: null },
                OR: [
                    { purchasePrice: 0 },
                    { profit: 0 }
                ]
            },
            include: {
                medicine: true
            }
        });
        console.log(`Found ${billItems.length} items to process.`);
        let processed = 0;
        let updated = 0;
        for (const i of billItems) {
            const item = i;
            processed++;
            if (processed % 50 === 0)
                console.log(`Processed ${processed}/${billItems.length}...`);
            const unitPrice = Number(item.unitPrice) || 0;
            const quantity = Number(item.quantity) || 0;
            const total = Number(item.total) || 0;
            let purchasePrice = 0;
            // Try to find the exact batch price first if batchNumber exists
            if (item.batchNumber) {
                const batch = await prisma.medicineBatch.findFirst({
                    where: {
                        medicineId: item.medicineId,
                        batchNumber: item.batchNumber,
                        isActive: true
                    }
                });
                if (batch) {
                    purchasePrice = Number(batch.purchasePrice) || 0;
                }
            }
            // Fallback to Medicine.pricePerUnit if batch not found or price is 0
            if (purchasePrice === 0 && item.medicine) {
                purchasePrice = Number(item.medicine.pricePerUnit) || 0;
            }
            // Recalculate profit using stored snapshot or fallback
            const calculatedProfit = (unitPrice - purchasePrice) * quantity;
            await prisma.billItem.update({
                where: { id: item.id },
                data: {
                    purchasePrice: purchasePrice,
                    profit: calculatedProfit
                }
            });
            updated++;
        }
        console.log(`Backfill completed successfully. Updated ${updated} items.`);
    }
    catch (error) {
        console.error('Backfill failed:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
backfillProfit();
//# sourceMappingURL=backfill-profit.js.map