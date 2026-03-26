import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function backfillBillType() {
    console.log('Starting bill type and profit backfill...');
    try {
        // 1. Set billType = 'PHARMACY' for bills with bill numbers starting with 'PH-'
        const pharmacyResult = await prisma.$executeRawUnsafe(`
            UPDATE bills
            SET bill_type = 'PHARMACY'
            WHERE bill_number LIKE 'PH-%'
              AND (bill_type IS NULL OR bill_type = 'PHARMACY')
        `);
        console.log(`[1/5] Marked ${pharmacyResult} bills as PHARMACY (PH- prefix).`);
        // 2. Set billType = 'LAB' for bills linked to lab test orders
        const labResult = await prisma.$executeRawUnsafe(`
            UPDATE bills
            SET bill_type = 'LAB'
            WHERE id IN (
                SELECT DISTINCT bill_id FROM lab_test_orders WHERE bill_id IS NOT NULL
            )
            AND bill_type != 'PHARMACY'
        `);
        console.log(`[2/5] Marked ${labResult} bills as LAB (linked to lab orders).`);
        // 3. Set billType = 'CONSULTATION' for remaining INV- bills that are not PHARMACY or LAB
        const consultResult = await prisma.$executeRawUnsafe(`
            UPDATE bills
            SET bill_type = 'CONSULTATION'
            WHERE bill_number LIKE 'INV-%'
              AND bill_type NOT IN ('PHARMACY', 'LAB')
        `);
        console.log(`[3/5] Marked ${consultResult} bills as CONSULTATION (INV- prefix, non-lab).`);
        // 4. Catch-all: any remaining bills without a type get CONSULTATION
        const catchAll = await prisma.$executeRawUnsafe(`
            UPDATE bills
            SET bill_type = 'CONSULTATION'
            WHERE bill_type IS NULL OR bill_type = ''
        `);
        console.log(`[4/5] Catch-all: marked ${catchAll} remaining bills as CONSULTATION.`);
        // 5. Recalculate profit for all bill items with valid purchase price
        const profitResult = await prisma.$executeRawUnsafe(`
            UPDATE bill_items
            SET profit = (unit_price - purchase_price) * quantity
            WHERE purchase_price IS NOT NULL
              AND purchase_price > 0
        `);
        console.log(`[5/5] Recalculated profit for ${profitResult} bill items.`);
        // Summary
        const summary = await prisma.$queryRawUnsafe(`
            SELECT bill_type, COUNT(*)::int AS count
            FROM bills
            GROUP BY bill_type
            ORDER BY bill_type
        `);
        console.log('\n--- Bill Type Summary ---');
        summary.forEach((row) => {
            console.log(`  ${row.bill_type}: ${row.count} bills`);
        });
        console.log('\nBackfill completed successfully!');
    }
    catch (error) {
        console.error('Backfill failed:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
backfillBillType();
//# sourceMappingURL=backfill-bill-type.js.map