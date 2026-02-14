
import { PrismaClient, UserRole, UserStatus, Gender, AppointmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // 1. Clean existing data (optional, but good for demo)
    // await prisma.billItem.deleteMany();
    // await prisma.bill.deleteMany();
    // await prisma.prescription.deleteMany();
    // await prisma.medicalRecord.deleteMany();
    // await prisma.appointment.deleteMany();
    // await prisma.labTestResult.deleteMany();
    // await prisma.labTestOrder.deleteMany();
    // await prisma.medicine.deleteMany();
    // await prisma.patient.deleteMany();
    // await prisma.staff.deleteMany();
    // await prisma.user.deleteMany();

    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // --- USERS & STAFF ---

    // Admin (already exists from previous step probably, but let's ensure)
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@saiphani.com' },
        update: {},
        create: {
            email: 'admin@saiphani.com',
            passwordHash: await bcrypt.hash('AdminPassword123!', 10),
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        },
    });
    console.log('✅ Admin user ready');

    // Doctor
    const doctorUser = await prisma.user.create({
        data: {
            email: 'doctor@saiphani.com',
            passwordHash: hashedPassword,
            role: UserRole.DOCTOR,
            status: UserStatus.ACTIVE,
            staff: {
                create: {
                    firstName: 'Dr. Ravi',
                    lastName: 'Kumar',
                    phone: '9876543210',
                    specialization: 'Neurology',
                    department: 'Neuro',
                    licenseNo: 'MCI-1001',
                },
            },
        },
        include: { staff: true },
    });
    console.log('✅ Doctor created: doctor@saiphani.com');

    // Receptionist
    const receptionistUser = await prisma.user.create({
        data: {
            email: 'reception@saiphani.com',
            passwordHash: hashedPassword,
            role: UserRole.RECEPTIONIST,
            status: UserStatus.ACTIVE,
            staff: {
                create: {
                    firstName: 'Anjali',
                    lastName: 'Sharma',
                    phone: '9876543211',
                    department: 'Front Desk',
                },
            },
        },
    });
    console.log('✅ Receptionist created: reception@saiphani.com');

    // Pharmacist
    const pharmacistUser = await prisma.user.create({
        data: {
            email: 'pharma@saiphani.com',
            passwordHash: hashedPassword,
            role: UserRole.PHARMACIST,
            status: UserStatus.ACTIVE,
            staff: {
                create: {
                    firstName: 'Priya',
                    lastName: 'Reddy',
                    phone: '9876543212',
                    department: 'Pharmacy',
                    licenseNo: 'PH-2023',
                },
            },
        },
    });
    console.log('✅ Pharmacist created: pharma@saiphani.com');

    // Lab Technician
    const labTechUser = await prisma.user.create({
        data: {
            email: 'lab@saiphani.com',
            passwordHash: hashedPassword,
            role: UserRole.LAB_TECHNICIAN,
            status: UserStatus.ACTIVE,
            staff: {
                create: {
                    firstName: 'Suresh',
                    lastName: 'Verma',
                    phone: '9876543213',
                    department: 'Pathology',
                },
            },
        },
        include: { staff: true },
    });
    console.log('✅ Lab Tech created: lab@saiphani.com');

    // --- PATIENT ---

    const patientUser = await prisma.user.create({
        data: {
            email: 'patient@saiphani.com',
            passwordHash: hashedPassword,
            role: UserRole.PATIENT,
            status: UserStatus.ACTIVE,
            patient: {
                create: {
                    firstName: 'Rajesh',
                    lastName: 'Koothrappali',
                    dateOfBirth: new Date('1995-05-20'),
                    gender: Gender.MALE,
                    phone: '9988776655',
                    address: 'Flat 401, Galaxy Apartments, Hyderabad',
                    bloodGroup: 'B+',
                    allergies: 'Peanuts',
                },
            },
        },
        include: { patient: true },
    });
    console.log('✅ Patient created: patient@saiphani.com');

    if (!doctorUser.staff || !patientUser.patient) {
        throw new Error('Failed to create staff or patient relations');
    }

    const doctorId = doctorUser.staff.id;
    const patientId = patientUser.patient.uhid;

    // --- MEDICINES ---

    const med1 = await prisma.medicine.create({
        data: {
            name: 'Paracetamol',
            genericName: 'Acetaminophen',
            manufacturer: 'GSK',
            category: 'Analgesic',
            unit: 'Tablet',
            pricePerUnit: 5.00,
            stockQuantity: 1000,
            reorderLevel: 100,
            expiryDate: new Date('2027-12-31'),
        }
    });

    const med2 = await prisma.medicine.create({
        data: {
            name: 'Amoxicillin 500mg',
            genericName: 'Amoxicillin',
            manufacturer: 'Cipla',
            category: 'Antibiotic',
            unit: 'Capsule',
            pricePerUnit: 12.50,
            stockQuantity: 500,
            reorderLevel: 50,
            expiryDate: new Date('2026-06-30'),
        }
    });
    console.log('✅ Medicines created');

    // --- APPOINTMENT ---

    const appointment = await prisma.appointment.create({
        data: {
            patientId,
            doctorId,
            scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
            duration: 30,
            reason: 'Persistent headaches',
            status: AppointmentStatus.SCHEDULED,
            notes: 'Patient prefers evening slot',
        },
    });
    console.log('✅ Appointment created');

    // --- MEDICAL RECORD ---

    const medicalRecord = await prisma.medicalRecord.create({
        data: {
            patientId,
            doctorId,
            diagnosis: 'Migraine',
            treatment: 'Lifestyle changes and medication',
            notes: 'Patient advised to reduce screen time. Follow up in 2 weeks.',
            vitalSigns: {
                bp: '120/80',
                temp: '98.6',
                pulse: '72',
                weight: '70',
            },
        },
    });
    console.log('✅ Medical Record created');

    // --- PRESCRIPTION ---

    const prescription = await prisma.prescription.create({
        data: {
            patientId,
            doctorId,
            notes: 'Take with food',
            medicines: [
                {
                    name: 'Paracetamol',
                    dosage: '500mg',
                    frequency: 'SOS',
                    duration: '5 days',
                    instructions: 'For pain',
                }
            ],
        },
    });
    console.log('✅ Prescription created');

    // --- LAB ORDER ---

    const labOrder = await prisma.labTestOrder.create({
        data: {
            patientId,
            orderedById: doctorId,
            testName: 'MRI Brain',
            testCode: 'MRI-BRN',
            priority: 'normal',
            notes: 'Check for any structural abnormalities',
        },
    });
    console.log('✅ Lab Order created');

    // --- PHARMACY BILL ---

    const bill = await prisma.bill.create({
        data: {
            patientId,
            billNumber: `BILL-${Date.now()}`,
            subtotal: 100.00,
            gstAmount: 12.00,
            grandTotal: 112.00,
            items: {
                create: [
                    {
                        medicineId: med1.id,
                        description: 'Paracetamol x 20',
                        quantity: 20,
                        unitPrice: 5.00,
                        total: 100.00,
                    }
                ]
            }
        }
    });
    console.log('✅ Pharmacy Bill created');

    console.log('------------------------------------------------');
    console.log('🎉 SEEDING COMPLETE! You can use these IDs in Postman:');
    console.log(`Doctor ID: ${doctorId}`);
    console.log(`Patient ID: ${patientId}`);
    console.log(`Medicine ID: ${med1.id}`);
    console.log(`Appointment ID: ${appointment.id}`);
    console.log('------------------------------------------------');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
