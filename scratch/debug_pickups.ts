import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const collectorName = 'Aziz Khan';
  
  // Find collector by name (firstName + lastName)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Aziz', mode: 'insensitive' } },
        { lastName: { contains: 'Khan', mode: 'insensitive' } }
      ]
    },
    include: {
      collectorProfile: true
    }
  });

  console.log('--- USERS FOUND ---');
  users.forEach(u => {
    console.log(`User: ${u.firstName} ${u.lastName} (ID: ${u.id})`);
    console.log(`CollectorProfile ID: ${u.collectorProfile?.id || 'NONE'}`);
  });

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  const collectorId = users[0].collectorProfile?.id;
  if (!collectorId) {
    console.log('First user found has no collector profile.');
    return;
  }

  // Find pickups assigned to this collector
  const pickups = await prisma.pickup.findMany({
    where: {
      collectorId: collectorId
    }
  });

  console.log('\n--- PICKUPS ASSIGNED ---');
  console.log(`Total: ${pickups.length}`);
  pickups.forEach(p => {
    console.log(`Ref: ${p.reference}, Status: ${p.status}, Scheduled: ${p.scheduledDate}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
