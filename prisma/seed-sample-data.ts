import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding sample data for all modules...\n');

    // ========================
    // 1. PHARMACY CATEGORIES
    // ========================
    console.log('💊 Seeding pharmacy categories...');
    const categories = ['Tablets', 'Capsules', 'Syrups', 'Injections', 'Ointments', 'Drops', 'Powders', 'Inhalers'];
    const categoryMap: Record<string, number> = {};
    
    for (const name of categories) {
        const cat = await prisma.pharmacyCategory.upsert({
            where: { name },
            update: {},
            create: { name },
        });
        categoryMap[name] = cat.id;
    }
    console.log(`  ✅ ${categories.length} categories created\n`);

    // ========================
    // 2. MEDICINES
    // ========================
    console.log('💊 Seeding medicines...');
    const medicines = [
        { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', manufacturer: 'Cipla', category: 'Tablets', unit: 'tablet', pricePerUnit: 2.50, stockQuantity: 500, reorderLevel: 50, hsnCode: '30049099' },
        { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', manufacturer: 'Sun Pharma', category: 'Capsules', unit: 'capsule', pricePerUnit: 8.00, stockQuantity: 300, reorderLevel: 30, hsnCode: '30041090' },
        { name: 'Azithromycin 500mg', genericName: 'Azithromycin', manufacturer: 'Zydus', category: 'Tablets', unit: 'tablet', pricePerUnit: 25.00, stockQuantity: 200, reorderLevel: 20, hsnCode: '30049099' },
        { name: 'Cetirizine 10mg', genericName: 'Cetirizine', manufacturer: 'Dr. Reddys', category: 'Tablets', unit: 'tablet', pricePerUnit: 3.00, stockQuantity: 400, reorderLevel: 40, hsnCode: '30049099' },
        { name: 'Omeprazole 20mg', genericName: 'Omeprazole', manufacturer: 'Cipla', category: 'Capsules', unit: 'capsule', pricePerUnit: 5.50, stockQuantity: 350, reorderLevel: 35, hsnCode: '30049099' },
        { name: 'Metformin 500mg', genericName: 'Metformin HCl', manufacturer: 'USV', category: 'Tablets', unit: 'tablet', pricePerUnit: 4.00, stockQuantity: 600, reorderLevel: 60, hsnCode: '30049099' },
        { name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', manufacturer: 'Ranbaxy', category: 'Tablets', unit: 'tablet', pricePerUnit: 7.00, stockQuantity: 250, reorderLevel: 25, hsnCode: '30049099' },
        { name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', manufacturer: 'Micro Labs', category: 'Tablets', unit: 'tablet', pricePerUnit: 3.50, stockQuantity: 450, reorderLevel: 45, hsnCode: '30049099' },
        { name: 'Cough Syrup (Ascoril)', genericName: 'Terbutaline + Bromhexine', manufacturer: 'Glenmark', category: 'Syrups', unit: 'bottle', pricePerUnit: 120.00, stockQuantity: 80, reorderLevel: 10, hsnCode: '30049099' },
        { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', manufacturer: 'Alkem', category: 'Tablets', unit: 'tablet', pricePerUnit: 6.00, stockQuantity: 300, reorderLevel: 30, hsnCode: '30049099' },
        { name: 'Dolo 650mg', genericName: 'Paracetamol', manufacturer: 'Micro Labs', category: 'Tablets', unit: 'tablet', pricePerUnit: 3.50, stockQuantity: 800, reorderLevel: 80, hsnCode: '30049099' },
        { name: 'Augmentin 625mg', genericName: 'Amoxicillin + Clavulanic Acid', manufacturer: 'GSK', category: 'Tablets', unit: 'tablet', pricePerUnit: 22.00, stockQuantity: 150, reorderLevel: 15, hsnCode: '30041090' },
        { name: 'Montelukast 10mg', genericName: 'Montelukast', manufacturer: 'Sun Pharma', category: 'Tablets', unit: 'tablet', pricePerUnit: 9.00, stockQuantity: 200, reorderLevel: 20, hsnCode: '30049099' },
        { name: 'Diclofenac Gel', genericName: 'Diclofenac Diethylamine', manufacturer: 'Novartis', category: 'Ointments', unit: 'tube', pricePerUnit: 85.00, stockQuantity: 60, reorderLevel: 8, hsnCode: '30049099' },
        { name: 'Betadine Solution', genericName: 'Povidone Iodine', manufacturer: 'Win Medicare', category: 'Drops', unit: 'bottle', pricePerUnit: 55.00, stockQuantity: 40, reorderLevel: 5, hsnCode: '30049099' },
        { name: 'ORS Powder', genericName: 'Oral Rehydration Salts', manufacturer: 'Electral', category: 'Powders', unit: 'sachet', pricePerUnit: 20.00, stockQuantity: 200, reorderLevel: 20, hsnCode: '30049099' },
        { name: 'Salbutamol Inhaler', genericName: 'Salbutamol', manufacturer: 'Cipla', category: 'Inhalers', unit: 'inhaler', pricePerUnit: 150.00, stockQuantity: 30, reorderLevel: 5, hsnCode: '30049099' },
        { name: 'Ranitidine 150mg', genericName: 'Ranitidine', manufacturer: 'J B Chemicals', category: 'Tablets', unit: 'tablet', pricePerUnit: 4.50, stockQuantity: 0, reorderLevel: 30, hsnCode: '30049099' },
        { name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin', manufacturer: 'Cipla', category: 'Tablets', unit: 'tablet', pricePerUnit: 12.00, stockQuantity: 5, reorderLevel: 20, hsnCode: '30049099' },
        { name: 'Vitamin B Complex', genericName: 'Multivitamin B', manufacturer: 'Abbott', category: 'Tablets', unit: 'tablet', pricePerUnit: 2.00, stockQuantity: 500, reorderLevel: 50, hsnCode: '30049099' },
    ];

    const medicineRecords: any[] = [];
    for (const med of medicines) {
        const record = await prisma.medicine.create({
            data: {
                name: med.name,
                genericName: med.genericName,
                manufacturer: med.manufacturer,
                category: med.category,
                unit: med.unit,
                pricePerUnit: med.pricePerUnit,
                stockQuantity: med.stockQuantity,
                reorderLevel: med.reorderLevel,
                hsnCode: med.hsnCode,
                categoryId: categoryMap[med.category] || null,
                isActive: true,
            }
        });
        medicineRecords.push(record);
    }
    console.log(`  ✅ ${medicines.length} medicines created\n`);

    // ========================
    // 3. MEDICINE BATCHES
    // ========================
    console.log('📦 Seeding medicine batches...');
    const now = new Date();
    let batchCount = 0;
    for (const med of medicineRecords) {
        if (med.stockQuantity > 0) {
            await prisma.medicineBatch.create({
                data: {
                    medicineId: med.id,
                    batchNumber: `BATCH-${med.name.substring(0, 3).toUpperCase()}-${String(batchCount + 1).padStart(3, '0')}`,
                    distributorName: ['MedPlus Distributors', 'HealthCare Supplies', 'PharmaCare India', 'Apollo Pharma Distributors'][batchCount % 4],
                    expiryDate: new Date(now.getFullYear() + 1, now.getMonth() + (batchCount % 12), 1),
                    purchasePrice: Number(med.pricePerUnit) * 0.7,
                    sellingPrice: Number(med.pricePerUnit),
                    mrp: Number(med.pricePerUnit) * 1.1,
                    gstPercent: 12,
                    stockQuantity: med.stockQuantity,
                    isActive: true,
                    hsnCode: med.hsnCode,
                }
            });
            batchCount++;
        }
    }
    console.log(`  ✅ ${batchCount} batches created\n`);

    // ========================
    // 4. PATIENTS
    // ========================
    console.log('🧑‍🤝‍🧑 Seeding patients...');
    const patients = [
        { firstName: 'Rajesh', lastName: 'Kumar', dateOfBirth: new Date('1985-03-15'), gender: 'MALE' as const, phone: '9876543210', email: 'rajesh.kumar@email.com', address: 'H.No 12-3-456, Karimnagar', bloodGroup: 'O+', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Priya', lastName: 'Sharma', dateOfBirth: new Date('1990-07-22'), gender: 'FEMALE' as const, phone: '9876543211', email: 'priya.sharma@email.com', address: 'Flat 201, Sai Residency, Karimnagar', bloodGroup: 'A+', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Venkat', lastName: 'Reddy', dateOfBirth: new Date('1975-11-08'), gender: 'MALE' as const, phone: '9876543212', email: 'venkat.reddy@email.com', address: '3-4-567, Mukarampura, Karimnagar', bloodGroup: 'B+', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Lakshmi', lastName: 'Devi', dateOfBirth: new Date('1988-01-30'), gender: 'FEMALE' as const, phone: '9876543213', address: '7-8-123, Kothirampur, Karimnagar', bloodGroup: 'AB+', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Suresh', lastName: 'Babu', dateOfBirth: new Date('1965-05-12'), gender: 'MALE' as const, phone: '9876543214', address: '10-2-345, Vidyanagar, Karimnagar', bloodGroup: 'O-', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Anjali', lastName: 'Patel', dateOfBirth: new Date('1995-09-18'), gender: 'FEMALE' as const, phone: '9876543215', email: 'anjali.patel@email.com', address: '5-6-789, Chaitanyapuri, Karimnagar', bloodGroup: 'A-', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Ramesh', lastName: 'Yadav', dateOfBirth: new Date('1970-12-25'), gender: 'MALE' as const, phone: '9876543216', address: '1-2-100, Jyothinagar, Karimnagar', bloodGroup: 'B-', district: 'Karimnagar', state: 'Telangana' },
        { firstName: 'Swetha', lastName: 'Nair', dateOfBirth: new Date('1992-04-05'), gender: 'FEMALE' as const, phone: '9876543217', email: 'swetha.nair@email.com', address: '15-3-200, Saipuri Colony, Karimnagar', bloodGroup: 'O+', district: 'Karimnagar', state: 'Telangana' },
    ];

    for (const pat of patients) {
        await prisma.patient.create({
            data: {
                firstName: pat.firstName,
                lastName: pat.lastName,
                dateOfBirth: pat.dateOfBirth,
                gender: pat.gender,
                phone: pat.phone,
                email: pat.email || null,
                address: pat.address,
                bloodGroup: pat.bloodGroup,
                district: pat.district || null,
                state: pat.state || null,
                title: pat.gender === 'MALE' ? 'Mr.' : 'Ms.',
                paymentMode: 'CASH',
            }
        });
    }
    console.log(`  ✅ ${patients.length} patients created\n`);

    // ========================
    // 5. HOSPITAL SETTINGS
    // ========================
    console.log('🏥 Seeding hospital settings...');
    const existingSettings = await prisma.hospitalSettings.findFirst();
    if (!existingSettings) {
        await prisma.hospitalSettings.create({
            data: {
                hospitalName: 'Swetha SaiPhani Clinics',
                address: 'Karimnagar, Telangana',
                contactNumber: '+91-9876543200',
                email: 'info@swethasaiphani.clinic',
                website: 'https://swethasaiphani.clinic',
            }
        });
        console.log('  ✅ Hospital settings created\n');
    } else {
        console.log('  ⏩ Hospital settings already exist\n');
    }

    // ========================
    // SUMMARY
    // ========================
    const medCount = await prisma.medicine.count();
    const batchTotalCount = await prisma.medicineBatch.count();
    const patientCount = await prisma.patient.count();
    const catCount = await prisma.pharmacyCategory.count();

    console.log('📊 Seed Summary:');
    console.log(`  Categories:      ${catCount}`);
    console.log(`  Medicines:       ${medCount}`);
    console.log(`  Batches:         ${batchTotalCount}`);
    console.log(`  Patients:        ${patientCount}`);
    console.log('\n✅ All sample data seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
