import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function repair() {
    console.log('🛠️ Starting Lab Test Catalog Repair...');
    // 1. Get ALL tests
    const allTests = await prisma.labTest.findMany({
        include: {
            categories: { include: { parameters: true } },
            parameters: true
        }
    });
    console.log(`📋 Found ${allTests.length} total tests in the catalog.`);
    // 2. Group tests by code
    const testGroups = {};
    for (const t of allTests) {
        if (!testGroups[t.code])
            testGroups[t.code] = [];
        testGroups[t.code].push(t);
    }
    let repairedCount = 0;
    // 3. Analyze each group
    for (const code in testGroups) {
        const group = testGroups[code];
        // Skip if there's no duplication
        if (group.length <= 1)
            continue;
        const parameterizedTests = group.filter(t => {
            return (t.parameters && t.parameters.length > 0) ||
                (t.categories && t.categories.some((c) => c.parameters && c.parameters.length > 0));
        });
        const activeTests = group.filter(t => t.isActive);
        // We only care if:
        // 1. There is an active test with NO parameters.
        // 2. There is an INACTIVE test WITH parameters.
        const brokenActive = activeTests.find(t => !parameterizedTests.some(pt => pt.id === t.id));
        const richInactive = parameterizedTests.find(t => !t.isActive);
        if (brokenActive && richInactive) {
            console.log(`\n⚠️ Found corrupted state for code '${code}':`);
            console.log(`   - Empty Active Test   : ${brokenActive.id} ('${brokenActive.name}')`);
            console.log(`   - Rich Inactive Test  : ${richInactive.id} ('${richInactive.name}')`);
            try {
                // Step 1: Deactivate the empty one and change its code to avoid unique constraints
                await prisma.labTest.update({
                    where: { id: brokenActive.id },
                    data: {
                        isActive: false,
                        code: `${brokenActive.code}_ARCHIVED_${Date.now()}`
                    }
                });
                // Step 2: Reactivate the rich parameterized one
                await prisma.labTest.update({
                    where: { id: richInactive.id },
                    data: {
                        isActive: true
                    }
                });
                console.log(`✅ Repaired '${code}'! Swapped active status so the rich parameters are now live.`);
                repairedCount++;
            }
            catch (e) {
                console.error(`❌ Failed to repair '${code}':`, e);
            }
        }
    }
    console.log('\n--- Repair Summary ---');
    console.log(`Total duplicated codes checked : ${Object.keys(testGroups).filter(k => testGroups[k].length > 1).length}`);
    console.log(`Successfully repaired tests    : ${repairedCount}`);
    console.log('----------------------');
}
repair()
    .catch(e => {
    console.error('Fatal repair error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=repair-test-catalog.js.map