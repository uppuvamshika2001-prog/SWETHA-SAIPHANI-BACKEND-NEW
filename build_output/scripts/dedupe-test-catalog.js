import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function dedupe() {
    console.log('🧪 Starting Lab Test Catalog Deduplication (Case-Insensitive)...');
    // 1. Get all tests
    const allTests = await prisma.labTest.findMany();
    // 2. Group by normalized code (uppercase)
    const groups = {};
    for (const test of allTests) {
        const key = test.code.toUpperCase();
        if (!groups[key])
            groups[key] = [];
        groups[key].push(test);
    }
    let mergedCount = 0;
    let deletedCount = 0;
    // 3. Process groups with duplicates
    for (const [code, tests] of Object.entries(groups)) {
        if (tests.length <= 1)
            continue;
        console.log(`\n🔄 Found ${tests.length} records for code: ${code}`);
        // Sort to pick the best master (Active first, then most recently updated)
        const sorted = tests.sort((a, b) => {
            if (a.isActive && !b.isActive)
                return -1;
            if (!a.isActive && b.isActive)
                return 1;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
        const master = sorted[0];
        const duplicates = sorted.slice(1);
        console.log(`   🏆 Master picked: ${master.name} (${master.id}) - Active: ${master.isActive}`);
        for (const dup of duplicates) {
            console.log(`   Merging duplicate: ${dup.name} (${dup.id})`);
            // A. Move Orders
            const orders = await prisma.labTestOrder.updateMany({
                where: { testId: dup.id },
                data: { testId: master.id, testCode: master.code, testName: master.name }
            });
            console.log(`      ✅ Moved ${orders.count} orders`);
            // B. Move/Delete Categories & Parameters
            // For safety, we delete duplicate templates to avoid FK issues, 
            // assuming the Master (seeded/active) has the correct template.
            await prisma.labTestParameter.deleteMany({ where: { testId: dup.id } });
            await prisma.labTestCategory.deleteMany({ where: { testId: dup.id } });
            // C. Delete Duplicate
            await prisma.labTest.delete({ where: { id: dup.id } });
            deletedCount++;
        }
        // Ensure master code is normalized to uppercase
        if (master.code !== code) {
            await prisma.labTest.update({
                where: { id: master.id },
                data: { code: code }
            });
            console.log(`      ✅ Master code normalized to: ${code}`);
        }
        mergedCount++;
    }
    console.log(`\n🎉 Deduplication complete!`);
    console.log(`   Groups merged: ${mergedCount}`);
    console.log(`   Extras deleted: ${deletedCount}`);
}
dedupe()
    .catch(e => {
    console.error('❌ Dedupe failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=dedupe-test-catalog.js.map