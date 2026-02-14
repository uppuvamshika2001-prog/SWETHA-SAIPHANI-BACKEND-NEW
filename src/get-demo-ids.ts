
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const doctor = await prisma.staff.findFirst({
        where: { user: { email: 'doctor@saiphani.com' } }
    });

    const patient = await prisma.patient.findFirst({
        where: { user: { email: 'patient@saiphani.com' } }
    });

    const output = `Doctor ID: ${doctor?.id}\nPatient ID: ${patient?.uhid}`;
    fs.writeFileSync('demo_ids.txt', output);
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
