import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export const pdfGenerator = {
    /**
     * Adds the "DUPLICATE COPY" stamp to a PDF document.
     */
    async addDuplicateStamp(pdfDoc: PDFDocument): Promise<void> {
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const { width, height } = pages[0].getSize();

        for (const page of pages) {
            page.drawText('DUPLICATE COPY', {
                x: width / 2 - 150,
                y: height / 2,
                size: 40,
                font: font,
                color: rgb(0.7, 0.7, 0.7),
                opacity: 0.5,
                rotate: degrees(45),
            });

            // Add date stamp at bottom
            page.drawText(`Downloaded on: ${new Date().toLocaleString()}`, {
                x: 20,
                y: 20,
                size: 10,
                font: font,
                color: rgb(0.5, 0.5, 0.5),
            });
        }
    },

    /**
     * Adds the Hospital Watermark background to a PDF document.
     * This simulates the "Original" with official letterhead/watermark.
     */
    async addHospitalWatermark(pdfDoc: PDFDocument): Promise<void> {
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const { width, height } = pages[0].getSize();

        for (const page of pages) {
            // Draw a large, diagonal watermark
            page.drawText('SWETHA SAIPHANI CLINICS', {
                x: 50,
                y: height / 2,
                size: 50,
                font: font,
                color: rgb(0.2, 0.6, 1.0), // Light blue branding
                opacity: 0.1,
                rotate: degrees(45),
            });

            // Could add logo image here if we had it
        }
    },

    /**
     * Generates a Prescription PDF from data.
     */
    async generatePrescriptionPDF(data: any, isFirstDownload: boolean): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const { width, height } = page.getSize();

        // Header
        page.drawText('PRESCRIPTION', { x: width / 2 - 50, y: height - 50, size: 20, font: boldFont });

        // Patient Details
        let y = height - 100;
        page.drawText(`Patient: ${data.patientName}`, { x: 50, y, size: 12, font });
        y -= 20;
        page.drawText(`Doctor: ${data.doctorName}`, { x: 50, y, size: 12, font });
        y -= 20;
        page.drawText(`Date: ${new Date(data.date).toLocaleDateString()}`, { x: 50, y, size: 12, font });

        y -= 40;
        page.drawText('Medicines:', { x: 50, y, size: 14, font: boldFont });
        y -= 20;

        // Medicines List
        if (Array.isArray(data.medicines)) {
            for (const med of data.medicines) {
                page.drawText(`- ${med.name} (${med.dosage}) - ${med.frequency} for ${med.duration}`, { x: 50, y, size: 10, font });
                y -= 15;
            }
        }

        // Apply Versioning Logic
        if (isFirstDownload) {
            await this.addHospitalWatermark(pdfDoc);
        } else {
            await this.addDuplicateStamp(pdfDoc);
        }

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    },

    /**
     * Processes an existing Lab Report file (PDF).
     * Assuming the input `fileBuffer` is a CLEAN PDF (without watermark).
     */
    async processLabReport(fileBuffer: Buffer, isFirstDownload: boolean): Promise<Buffer> {
        try {
            const pdfDoc = await PDFDocument.load(fileBuffer);

            if (isFirstDownload) {
                await this.addHospitalWatermark(pdfDoc);
            } else {
                await this.addDuplicateStamp(pdfDoc);
            }

            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);
        } catch (error) {
            console.error('Error processing PDF:', error);
            // Fallback: If it's not a valid PDF or fails, return original buffer 
            // (Use with caution, maybe handle error upstream)
            throw error;
        }
    }
};
