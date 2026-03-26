import cron from 'node-cron';
import { prisma } from '../config/database.js';
/**
 * DAILY MEDICINE EXPIRY ALERT JOB
 *
 * Runs every day at Midnight (00:00).
 * Identifies medicine batches nearing expiration (within 1 month and 3 months)
 * and generates system notifications for Administrators and Pharmacists.
 */
const runExpiryAlerts = async () => {
    console.log('[JOBS] Starting Medicine Expiry Alert Job...');
    try {
        const today = new Date();
        // Reset time for strict day threshold comparison
        today.setHours(0, 0, 0, 0);
        // Fetch target users
        const notifyUsers = await prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'PHARMACIST'] },
                status: 'ACTIVE'
            },
            select: { id: true }
        });
        if (notifyUsers.length === 0) {
            console.log('[JOBS] No ADMIN or PHARMACIST users found to notify. Exiting...');
            return;
        }
        // Fetch batches that have stock AND are active AND haven't expired AND haven't received both alerts
        const activeBatches = await prisma.medicineBatch.findMany({
            where: {
                isActive: true,
                stockQuantity: { gt: 0 },
                expiryDate: { gt: today },
                OR: [
                    { expiryAlert3mSent: false },
                    { expiryAlert1mSent: false }
                ]
            },
            include: {
                medicine: { select: { name: true } }
            }
        });
        console.log(`[JOBS] Scanning ${activeBatches.length} active unalerted batches for expiry thresholds...`);
        for (const batch of activeBatches) {
            // Calculate strict day differential between current time and expiry
            const msPerDay = 1000 * 60 * 60 * 24;
            const expiry = new Date(batch.expiryDate);
            expiry.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / msPerDay);
            let alertType = null;
            let title = '';
            let message = '';
            // 1-MONTH ALERT logic: Expiring in <=30 days but >0 days
            if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && !batch.expiryAlert1mSent) {
                alertType = '1M';
                title = 'Urgent: Medicine Expiring Soon (<1 Month)';
                message = `${batch.medicine.name} (Batch: ${batch.batchNumber}) is expiring in ${daysUntilExpiry} days on ${expiry.toISOString().split('T')[0]}. Current stock: ${batch.stockQuantity}.`;
            }
            // 3-MONTH ALERT logic: Expiring between 61 and 90 days (<=90)
            else if (daysUntilExpiry <= 90 && daysUntilExpiry > 60 && !batch.expiryAlert3mSent) {
                alertType = '3M';
                title = 'Warning: Medicine Expiring in <3 Months';
                message = `${batch.medicine.name} (Batch: ${batch.batchNumber}) is expiring in ${daysUntilExpiry} days on ${expiry.toISOString().split('T')[0]}. Current stock: ${batch.stockQuantity}.`;
            }
            // Execute transactional alerting if Threshold hit
            if (alertType) {
                console.log(`[JOBS] Threshold triggered for batch ${batch.id} [${alertType}] - Days left: ${daysUntilExpiry}`);
                const notifications = notifyUsers.map(u => ({
                    recipientId: u.id,
                    title,
                    message,
                    type: "expiry",
                    referenceId: batch.id,
                    actionUrl: `/pharmacy/inventory`
                }));
                // Guarantee alert logs and flags persist perfectly together
                await prisma.$transaction(async (tx) => {
                    await tx.notification.createMany({ data: notifications });
                    await tx.medicineBatch.update({
                        where: { id: batch.id },
                        data: {
                            ...(alertType === '3M' ? { expiryAlert3mSent: true } : {}),
                            ...(alertType === '1M' ? { expiryAlert1mSent: true } : {})
                        }
                    });
                });
            }
        }
        console.log('[JOBS] Medicine Expiry Alert Job Completed Successfully.');
    }
    catch (error) {
        console.error('[JOBS] CRITICAL ERROR matching medicines for Expiry:', error);
    }
};
// Mount daemon securely
cron.schedule('0 0 * * *', runExpiryAlerts, {
    timezone: "Asia/Kolkata"
});
export { runExpiryAlerts };
//# sourceMappingURL=expiryAlert.job.js.map