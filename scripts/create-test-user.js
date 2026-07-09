const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

function generateBinQrCode(userPrefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BIN-${userPrefix}-${code}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const phone = process.env.MOCK_PHONE_NUMBER || '+1234567890';
  const email = 'playstore.tester@smarteco.rw';

  console.log(`Checking for test user with phone: ${phone}`);

  try {
    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (user) {
      console.log(`Test user already exists: ${user.id} (${user.phone}). Skipping creation.`);
      
      // Check if bins exist, if not create them
      const binsCount = await prisma.bin.count({
        where: { userId: user.id },
      });
      if (binsCount === 0) {
        console.log(`Creating default bins for existing test user...`);
        const userPrefix = user.id.substring(0, 3).toUpperCase();
        const binTypes = ['ORGANIC', 'RECYCLABLE', 'EWASTE', 'GENERAL', 'GLASS', 'HAZARDOUS'];
        const binData = binTypes.map((wasteType) => ({
          userId: user.id,
          wasteType,
          qrCode: generateBinQrCode(userPrefix),
          status: 'ACTIVE',
        }));
        await prisma.bin.createMany({ data: binData });
        console.log(`Bins created successfully.`);
      }
    } else {
      console.log(`Test user does not exist. Creating new test user...`);
      const referralCode = 'TESTER' + Math.random().toString(36).substring(2, 7).toUpperCase();
      
      user = await prisma.user.create({
        data: {
          phone,
          email,
          firstName: 'Play Store',
          lastName: 'Tester',
          role: 'USER',
          userType: 'RESIDENTIAL',
          referralCode,
          isActive: true,
        },
      });

      console.log(`Test user created successfully: ${user.id}`);

      // Create EcoPoints welcome transaction
      await prisma.ecoPointTransaction.create({
        data: {
          userId: user.id,
          points: 100,
          action: 'REGISTRATION',
          description: 'Welcome bonus: 100 EcoPoints',
        },
      });
      console.log(`EcoPoints welcome bonus of 100 added.`);

      // Create default bins
      const userPrefix = user.id.substring(0, 3).toUpperCase();
      const binTypes = ['ORGANIC', 'RECYCLABLE', 'EWASTE', 'GENERAL', 'GLASS', 'HAZARDOUS'];
      const binData = binTypes.map((wasteType) => ({
        userId: user.id,
        wasteType,
        qrCode: generateBinQrCode(userPrefix),
        status: 'ACTIVE',
      }));

      await prisma.bin.createMany({ data: binData });
      console.log(`Default bins created successfully.`);
    }

    // Verify everything is set up
    const finalUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        bins: true,
        ecoPoints: true,
      },
    });

    console.log('\n--- Test User Verification Summary ---');
    console.log(`ID: ${finalUser.id}`);
    console.log(`Phone: ${finalUser.phone}`);
    console.log(`Email: ${finalUser.email}`);
    console.log(`Name: ${finalUser.firstName} ${finalUser.lastName}`);
    console.log(`Role: ${finalUser.role}`);
    console.log(`EcoPoints Transactions Count: ${finalUser.ecoPoints.length}`);
    console.log(`Waste Bins Count: ${finalUser.bins.length} (${finalUser.bins.map(b => b.wasteType).join(', ')})`);
    console.log('--------------------------------------\n');

  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
