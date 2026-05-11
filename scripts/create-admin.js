const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = process.env.ADMIN_EMAIL || 'admin@smarteco.rw';
  
  console.log(`Checking for admin user: ${email}`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      console.log(`User already exists. Updating role to ADMIN...`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      console.log(`User ${email} updated to ADMIN.`);
    } else {
      console.log(`User does not exist. Creating new admin user...`);
      const newUser = await prisma.user.create({
        data: {
          email,
          phone: 'ADMIN_PORTAL',
          role: 'ADMIN',
          firstName: 'System',
          lastName: 'Administrator',
          referralCode: 'ADMIN' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        },
      });
      console.log(`Admin user created: ${newUser.id}`);
    }
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
