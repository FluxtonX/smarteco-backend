const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smarteco';

const pool = new Pool({
  connectionString,
  ssl: false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Create a test user
  const user = await prisma.user.upsert({
    where: { phone: '+250788888888' },
    update: {},
    create: {
      phone: '+250788888888',
      email: 'test@smarteco.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
    },
  });

  console.log('Test User created/found:', user.id);

  // 2. Create a test bin with calibration heights
  const bin = await prisma.bin.upsert({
    where: { qrCode: 'BIN-TEST-123' },
    update: {
      emptyHeightMm: 1200,
      fullHeightMm: 200,
    },
    create: {
      qrCode: 'BIN-TEST-123',
      userId: user.id,
      wasteType: 'GENERAL',
      emptyHeightMm: 1200,
      fullHeightMm: 200,
      status: 'ACTIVE',
    },
  });

  console.log('Test Bin created/found:', bin.id);

  // 3. Create and link the LoRaWAN IoT Device EUI (lowercase)
  const iotDevice = await prisma.iotDevice.upsert({
    where: { deviceId: '24e124329f107466' },
    update: {
      binId: bin.id,
      userId: user.id,
    },
    create: {
      deviceId: '24e124329f107466',
      binId: bin.id,
      userId: user.id,
      status: 'ONLINE',
    },
  });

  console.log('IoT Device linked to Bin:', iotDevice.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
