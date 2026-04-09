import { PrismaClient, WasteType, BinStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Safi111*%23*@localhost:5432/smarteco";

const pool = new pg.Pool({ connectionString, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('--- Starting Bin Seeding ---');

  const users = await prisma.user.findMany({
    where: { role: 'USER' }
  });

  if (users.length === 0) {
    console.log('No users found to assign bins to. Please run seed-test-users.ts first.');
    return;
  }

  for (const user of users) {
    // Check if user already has bins
    const existingCount = await prisma.bin.count({ where: { userId: user.id } });
    if (existingCount > 0) {
      console.log(`User ${user.firstName} already has ${existingCount} bins. Skipping...`);
      continue;
    }

    await prisma.bin.createMany({
      data: [
        {
          userId: user.id,
          wasteType: WasteType.ORGANIC,
          qrCode: `ORG-${user.phone.slice(-4)}`,
          fillLevel: 45,
          status: BinStatus.ACTIVE,
          latitude: -1.9441,
          longitude: 30.0619,
        },
        {
          userId: user.id,
          wasteType: WasteType.RECYCLABLE,
          qrCode: `REC-${user.phone.slice(-4)}`,
          fillLevel: 92,
          status: BinStatus.FULL,
          latitude: -1.9442,
          longitude: 30.0620,
        },
        {
          userId: user.id,
          wasteType: WasteType.GENERAL,
          qrCode: `GEN-${user.phone.slice(-4)}`,
          fillLevel: 15,
          status: BinStatus.ACTIVE,
          latitude: -1.9443,
          longitude: 30.0621,
        }
      ]
    });
    console.log(`Created 3 bins for user: ${user.firstName}`);
  }

  console.log('--- Bin Seeding Completed ---');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
