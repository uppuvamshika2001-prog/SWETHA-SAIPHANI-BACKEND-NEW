import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { pdfGenerator } from '../../services/pdfGenerator.js';
import { AppError } from '../../utils/AppError.js';
import fs from 'fs/promises';
import path from 'path';

export async function downloadDocument(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { type } = req.params;
        const id = req.params.id as string;
        const userId = req.user!.userId;
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        let documentId = id;
        let data: any = null;
        let fileBuffer: Buffer | null = null;
        let filename = 'document.pdf';

        // 1. Fetch Document Data / File
        if (type === 'prescriptions') {
            const prescription = (await prisma.prescription.findUnique({
                where: { id },
                include: { patient: true, doctor: true }
            })) as any;
            if (!prescription) throw new AppError('Prescription not found', 404);
            if (!prescription.patient || !prescription.doctor) {
                throw new AppError('Prescription data incomplete', 500);
            }

            // Check Authorization (Patient can only download their own)
            if (req.user!.role === 'PATIENT' && prescription.patient.userId !== userId) {
                throw new AppError('Unauthorized', 403);
            }

            data = {
                patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
                doctorName: `${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
                date: prescription.createdAt,
                medicines: prescription.medicines
            };
            filename = `Prescription-${id}.pdf`;

        } else if (type === 'reports') {
            // Assuming this covers Lab Results which might be stored as LabTestResult
            // For this implementation, let's assume valid 'reports' are LabTestResults with a file path OR data

            // Logic for LabTestResult
            const labResult = (await prisma.labTestResult.findFirst({
                where: { orderId: id }, // Assuming ID passed is OrderID or ResultID
                include: { order: { include: { patient: true } } }
            })) as any;

            if (labResult && labResult.order && labResult.order.patient) {
                if (req.user!.role === 'PATIENT' && labResult.order.patient.userId !== userId) {
                    throw new AppError('Unauthorized', 403);
                }

                // If it has attachments (uploaded file)
                if (labResult.attachments && Array.isArray(labResult.attachments) && labResult.attachments.length > 0) {
                    // Get the first attachment
                    // Attachments are stored as URL/Path. We need local path.
                    // Assuming path structure matches static serve: /uploads/lab-results/filename
                    const attachmentUrl = labResult.attachments[0] as string;
                    const rawFilename = path.basename(attachmentUrl);
                    const filePath = path.join(process.cwd(), 'uploads', 'lab-results', rawFilename);

                    try {
                        fileBuffer = await fs.readFile(filePath);
                    } catch (err) {
                        throw new AppError('Report file not found on server', 404);
                    }
                    filename = `LabReport-${id}.pdf`;
                } else {
                    // Generate from data if no file
                    // Not implemented fully for data-only reports yet
                    throw new AppError('No report file available', 404);
                }
            } else {
                throw new AppError('Report not found', 404);
            }
        } else {
            throw new AppError('Invalid document type', 400);
        }

        // 2. Check Download History
        // Map route param type to Enum
        const docTypeEnum: any = type === 'prescriptions' ? 'PRESCRIPTION' : 'LAB_REPORT';

        const historyCount = await prisma.downloadHistory.count({
            where: {
                userId,
                documentId: id, // Use ID passed in param
                documentType: docTypeEnum
            }
        });

        const isFirstDownload = historyCount === 0;

        // 3. Generate/Process PDF
        let finalPdfBuffer: Buffer;

        if (type === 'prescriptions') {
            finalPdfBuffer = await pdfGenerator.generatePrescriptionPDF(data, isFirstDownload);
        } else {
            // Reports (File based)
            if (!fileBuffer) throw new AppError('File buffer missing', 500);
            finalPdfBuffer = await pdfGenerator.processLabReport(fileBuffer, isFirstDownload);
        }

        // 4. Record History (Wait for success before committing? Or commit first?)
        // Better to commit first or parallel to ensure "First" is consumed
        await prisma.downloadHistory.create({
            data: {
                userId,
                documentId: id,
                documentType: docTypeEnum,
                ipAddress: String(ipAddress)
            }
        });

        // 5. Send Response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(finalPdfBuffer);

    } catch (error) {
        next(error);
    }
}
