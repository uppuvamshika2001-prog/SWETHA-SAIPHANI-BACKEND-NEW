import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
export const pdfGenerator = {
    /**
     * Adds the "DUPLICATE COPY" stamp to a PDF document.
     */
    async addDuplicateStamp(pdfDoc) {
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
    async addHospitalWatermark(pdfDoc) {
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
    async generatePrescriptionPDF(data, isFirstDownload) {
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
        }
        else {
            await this.addDuplicateStamp(pdfDoc);
        }
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    },
    /**
     * Processes an existing Lab Report file (PDF).
     * Assuming the input `fileBuffer` is a CLEAN PDF (without watermark).
     */
    async processLabReport(fileBuffer, isFirstDownload) {
        try {
            const pdfDoc = await PDFDocument.load(fileBuffer);
            if (isFirstDownload) {
                await this.addHospitalWatermark(pdfDoc);
            }
            else {
                await this.addDuplicateStamp(pdfDoc);
            }
            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);
        }
        catch (error) {
            console.error('Error processing PDF:', error);
            // Fallback: If it's not a valid PDF or fails, return original buffer 
            // (Use with caution, maybe handle error upstream)
            throw error;
        }
    },
    /**
     * Generates a professional Lab Report PDF.
     */
    async generateLabReportPDF(data, isFirstDownload) {
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        // Header Title
        page.drawText('LABORATORY REPORT', {
            x: width / 2 - 80,
            y: height - 50,
            size: 20,
            font: boldFont,
            color: rgb(0.1, 0.3, 0.6)
        });
        // Horizontal Line
        page.drawLine({
            start: { x: 40, y: height - 60 },
            end: { x: width - 40, y: height - 60 },
            thickness: 2,
            color: rgb(0.1, 0.3, 0.6)
        });
        // Patient & Order Info
        let y = height - 90;
        const leftX = 50;
        const midX = width / 2 + 20;
        // Row 1
        page.drawText('Patient Name:', { x: leftX, y, size: 10, font: boldFont });
        page.drawText(data.patientName || 'N/A', { x: leftX + 80, y, size: 10, font });
        page.drawText('Ref. By Dr:', { x: midX, y, size: 10, font: boldFont });
        page.drawText(data.doctorName || 'N/A', { x: midX + 80, y, size: 10, font });
        // Row 2
        y -= 20;
        page.drawText('Patient UHID:', { x: leftX, y, size: 10, font: boldFont });
        page.drawText(data.patientId || 'N/A', { x: leftX + 80, y, size: 10, font });
        page.drawText('Report Date:', { x: midX, y, size: 10, font: boldFont });
        page.drawText(new Date().toLocaleDateString(), { x: midX + 80, y, size: 10, font });
        // Row 3 (Gender/Age)
        y -= 20;
        page.drawText('Age / Gender:', { x: leftX, y, size: 10, font: boldFont });
        page.drawText(`${data.gender || 'N/A'} / ${data.age || 'N/A'}`, { x: leftX + 80, y, size: 10, font });
        page.drawText('Order ID:', { x: midX, y, size: 10, font: boldFont });
        page.drawText(data.orderId || 'N/A', { x: midX + 80, y, size: 10, font });
        // Row 4 (Phone)
        y -= 20;
        page.drawText('Phone:', { x: leftX, y, size: 10, font: boldFont });
        page.drawText(data.phone || 'N/A', { x: leftX + 80, y, size: 10, font });
        // Table Header
        y -= 50;
        page.drawRectangle({
            x: 40,
            y,
            width: width - 80,
            height: 25,
            color: rgb(0.95, 0.95, 0.95)
        });
        const headerY = y + 7;
        page.drawText('TEST PARAMETER', { x: 50, y: headerY, size: 10, font: boldFont });
        page.drawText('VALUE', { x: 230, y: headerY, size: 10, font: boldFont });
        page.drawText('UNIT', { x: 330, y: headerY, size: 10, font: boldFont });
        page.drawText('REFERENCE RANGE', { x: 410, y: headerY, size: 10, font: boldFont });
        y -= 10;
        // Tests Table
        if (data.results && data.results.parameters) {
            for (const param of data.results.parameters) {
                // Check for page break
                if (y < 120) {
                    page = pdfDoc.addPage();
                    y = height - 50;
                }
                y -= 20;
                // Draw Parameter Name
                page.drawText(param.name || 'N/A', { x: 50, y, size: 10, font });
                // Draw Value (Bold if abnormal)
                const isAbnormal = param.flag !== 'NORMAL';
                page.drawText(String(param.value || 'N/A'), {
                    x: 230,
                    y,
                    size: 10,
                    font: isAbnormal ? boldFont : font,
                    color: isAbnormal ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
                });
                // Draw Unit
                page.drawText(param.unit || '', { x: 330, y, size: 10, font });
                // Draw Reference Range (Try both referenceRange and normalRange)
                const refRange = param.referenceRange || param.normalRange || 'N/A';
                page.drawText(String(refRange), { x: 410, y, size: 10, font });
                // Add horizontal line between rows
                page.drawLine({
                    start: { x: 40, y: y - 5 },
                    end: { x: width - 40, y: y - 5 },
                    thickness: 0.5,
                    color: rgb(0.9, 0.9, 0.9)
                });
            }
        }
        // Interpretation
        if (data.interpretation) {
            y -= 40;
            if (y < 100) {
                page = pdfDoc.addPage();
                y = height - 50;
            }
            page.drawText('INTERPRETATION:', { x: 50, y, size: 12, font: boldFont });
            y -= 20;
            const lines = data.interpretation.split('\n');
            for (const line of lines) {
                page.drawText(line, { x: 50, y, size: 10, font: italicFont });
                y -= 15;
            }
        }
        // Footer / Signature
        y = 100;
        page.drawLine({
            start: { x: 40, y },
            end: { x: width - 40, y },
            thickness: 1,
            color: rgb(0.1, 0.3, 0.6)
        });
        y -= 20;
        page.drawText('Electronic Report - No Signature Required', { x: 50, y, size: 8, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
        page.drawText('Analyzed by: Lab Technician', { x: width - 180, y, size: 9, font: boldFont });
        // Apply Versioning Logic
        if (isFirstDownload) {
            await this.addHospitalWatermark(pdfDoc);
        }
        else {
            await this.addDuplicateStamp(pdfDoc);
        }
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }
};
//# sourceMappingURL=pdfGenerator.js.map