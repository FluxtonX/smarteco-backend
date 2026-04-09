require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      phone: '+923001111111',
      firstName: 'Mudassir',
      lastName: '',
      email: 'mudassir@smarteco.rw',
      userType: 'RESIDENTIAL',
      role: 'USER',
      isActive: true,
      referralCode: 'MUDASSIR01',
    },
    {
      phone: '+923002222222',
      firstName: 'Ikram',
      lastName: '',
      email: 'ikram@smarteco.rw',
      userType: 'RESIDENTIAL',
      role: 'USER',
      isActive: true,
      referralCode: 'IKRAM01',
    },
    {
      phone: '+923003333333',
      firstName: 'Umar',
      lastName: 'Sadiq',
      email: 'umar.sadiq@smarteco.rw',
      userType: 'BUSINESS',
      role: 'USER',
      isActive: true,
      referralCode: 'UMARSADIQ01',
    },
  ];

  console.log('Seeding users (JS version)...');

  for (const user of users) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phone: user.phone }, { email: user.email }],
      },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: user,
      });
      console.log(`Updated user: ${user.firstName}`);
    } else {
      await prisma.user.create({
        data: user,
      });
      console.log(`Created user: ${user.firstName}`);
    }
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
