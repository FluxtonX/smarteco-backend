import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- COLLECTOR PROFILES ---');
  const profiles = await prisma.collectorProfile.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      }
    }
  });

  profiles.forEach(p => {
    console.log(`Profile ID: ${p.id}, User: ${p.user.firstName} ${p.user.lastName}, Phone: ${p.user.phone}`);
  });

  console.log('\n--- ALL PICKUPS ---');
  const pickups = await prisma.pickup.findMany({
    include: {
      collector: {
        include: {
          user: true
        }
      }
    }
  });

  pickups.forEach(p => {
    console.log(`Ref: ${p.reference}, Status: ${p.status}, CollectorID in Pickup: ${p.collectorId}`);
    if (p.collector) {
      console.log(`  Assigned to: ${p.collector.user.firstName} ${p.collector.user.lastName}`);
    } else {
      console.log('  Assigned to: NONE');
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
