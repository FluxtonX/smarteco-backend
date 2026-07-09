import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});

async function main() {
  const email = 'admin@smarteco.rw';
  
  console.log(`Checking for admin user: ${email}`);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
