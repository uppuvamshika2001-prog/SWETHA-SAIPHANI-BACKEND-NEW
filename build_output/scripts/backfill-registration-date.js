import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('Starting backfill for registrationDate...');
    // Get all patients with their createdAt dates
    const patients = await prisma.patient.findMany({
        select: {
            uhid: true,
            createdAt: true,
            registrationDate: true
        }
    });
    console.log(`Found ${patients.length} patients to check.`);
    let updatedCount = 0;
    for (const patient of patients) {
        // We want to set registrationDate to createdAt date if it hasn't been set or needs sync
        // Since registrationDate is @db.Date, it's already date-only in Postgres
        // But we want to ensure it matches the date of createdAt
        const targetDate = new Date(patient.createdAt);
        targetDate.setUTCHours(0, 0, 0, 0);
        // Update the record
        await prisma.patient.update({
            where: { uhid: patient.uhid },
            data: {
                registrationDate: targetDate
            }
        });
        updatedCount++;
    }
    console.log(`Successfully backfilled ${updatedCount} patients.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=backfill-registration-date.js.map