import { PrismaClient, UserRole, UserType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Safi111*%23*@localhost:5432/smarteco";

const pool = new pg.Pool({ connectionString, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('--- Starting Seeding ---');

  // 1. Residential User (Active)
  const user1 = await prisma.user.upsert({
    where: { phone: '0781234567' },
    update: {},
    create: {
      firstName: 'Mudassir',
      lastName: 'Safi',
      phone: '0781234567',
      email: 'mudassir@example.com',
      role: UserRole.USER,
      userType: UserType.RESIDENTIAL,
      isActive: true,
      referralCode: 'ECO-MUDA01'
    },
  });
  console.log('Created/Updated User 1:', user1.firstName);

  // 2. Business User (Active)
  const user2 = await prisma.user.upsert({
    where: { phone: '0787654321' },
    update: {},
    create: {
      firstName: 'Ikram',
      lastName: 'Khan',
      phone: '0787654321',
      email: 'ikram@business.com',
      role: UserRole.USER,
      userType: UserType.BUSINESS,
      isActive: true,
      referralCode: 'ECO-IKRA02'
    },
  });
  console.log('Created/Updated User 2:', user2.firstName);

  // 3. Suspended User (Residential)
  const user3 = await prisma.user.upsert({
    where: { phone: '0780000000' },
    update: {},
    create: {
      firstName: 'Umar',
      lastName: 'Sadiq',
      phone: '0780000000',
      email: 'umar@example.com',
      role: UserRole.USER,
      userType: UserType.RESIDENTIAL,
      isActive: false,
      referralCode: 'ECO-UMAR03'
    },
  });
  console.log('Created/Updated User 3:', user3.firstName);

  // 4. Admin User (for login)
  const admin = await prisma.user.upsert({
    where: { phone: '0780000001' },
    update: { role: UserRole.ADMIN },
    create: {
      firstName: 'Admin',
      lastName: 'User',
      phone: '0780000001',
      email: 'admin@smarteco.com',
      role: UserRole.ADMIN,
      userType: UserType.RESIDENTIAL,
      isActive: true,
      referralCode: 'ECO-ADMIN'
    },
  });
  console.log('Created/Updated Admin:', admin.firstName);

  // Add EcoPoints to show tier distribution in charts
  await prisma.ecoPointTransaction.createMany({
    skipDuplicates: true,
    data: [
      { userId: user1.id, points: 50, action: 'PICKUP_COMPLETED', description: 'Initial pickup reward' },
      { userId: user2.id, points: 250, action: 'PICKUP_COMPLETED', description: 'Business bulk pickup' },
    ],
  });

  console.log('EcoPoints seeded.');
  console.log('--- Seeding Completed Successfully ---');
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
