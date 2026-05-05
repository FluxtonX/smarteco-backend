import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@smarteco.rw';
  const phone = '+250788123456'; 
  
  console.log(`Checking for admin user with email: ${email}`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('User exists. Updating role to ADMIN...');
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { 
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('Admin user updated successfully.');
  } else {
    console.log('User does not exist. Creating new ADMIN user...');
    
    // Generate a random referral code
    const referralCode = 'ADM' + Math.random().toString(36).substring(2, 7).toUpperCase();
    
    await prisma.user.create({
      data: {
        email,
        phone,
        role: 'ADMIN',
        referralCode,
        firstName: 'System',
        lastName: 'Admin',
        userType: 'RESIDENTIAL',
        isActive: true,
      },
    });
    console.log('Admin user created successfully.');
  }
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
