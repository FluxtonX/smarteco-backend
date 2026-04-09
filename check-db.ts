import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Safi111*%23*@localhost:5432/smarteco";
const pool = new pg.Pool({ connectionString, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const count = await prisma.user.count();
  const users = await prisma.user.findMany({ select: { firstName: true, phone: true } });
  console.log('--- DATABASE CHECK ---');
  console.log('Total Users:', count);
  console.log('Users List:', users);
  console.log('--- END CHECK ---');
}
main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
