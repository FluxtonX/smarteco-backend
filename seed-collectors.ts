import { PrismaClient, UserRole } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  const collectors = [
    {
      phone: '+250788111222',
      firstName: 'Patrick',
      lastName: 'Mugisha',
      role: UserRole.COLLECTOR,
      profile: {
        vehiclePlate: 'RAD 123A',
        zone: 'Kigali',
        rating: 4.8,
        latitude: -1.9441,
        longitude: 30.0619,
      }
    },
    {
      phone: '+250788333444',
      firstName: 'Jean',
      lastName: 'Damascene',
      role: UserRole.COLLECTOR,
      profile: {
        vehiclePlate: 'RBA 456C',
        zone: 'Kigali',
        rating: 4.6,
        latitude: -1.9501,
        longitude: 30.0700,
      }
    }
  ];

  console.log('Seeding collectors...');

  for (const c of collectors) {
    const user = await prisma.user.upsert({
      where: { phone: c.phone },
      update: {
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
      },
      create: {
        phone: c.phone,
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        referralCode: 'COLL-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      },
    });

    await prisma.collectorProfile.upsert({
      where: { userId: user.id },
      update: {
        latitude: c.profile.latitude,
        longitude: c.profile.longitude,
        isAvailable: true,
      },
      create: {
        userId: user.id,
        vehiclePlate: c.profile.vehiclePlate,
        zone: c.profile.zone,
        rating: c.profile.rating,
        latitude: c.profile.latitude,
        longitude: c.profile.longitude,
        isAvailable: true,
      },
    });
  }

  console.log('Collectors seeded successfully');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
