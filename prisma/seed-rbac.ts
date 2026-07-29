import 'dotenv/config';
import { PrismaClient, RoleKey } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { flattenPermissions, ROLE_POLICIES } from '../src/authz/permissions';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/smarteco?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const META: Record<RoleKey, { name: string; description: string }> = {
  OPERATIONS_MANAGER: {
    name: 'Operations Manager',
    description: 'Owns collection delivery: requests, routes, schedules, fleet and bins.',
  },
  FINANCE_ADMIN: {
    name: 'Finance Admin',
    description: 'Owns billing, MoMo/Airtel settlement, refunds, tariffs and payouts.',
  },
  IOT_SUPERVISOR: {
    name: 'IoT Supervisor',
    description: 'Owns the device plane: gateways, sensors, alert rules, kiosks and model releases.',
  },
  SUPPORT_AGENT: {
    name: 'Support Agent',
    description: 'Front-line customer support. Read-mostly, masked PII, no bulk export.',
  },
};

async function main() {
  for (const key of Object.keys(ROLE_POLICIES) as RoleKey[]) {
    const slugs = flattenPermissions(key);

    const permissions = await Promise.all(
      slugs.map((slug) => {
        const [resource, action] = slug.split(':');
        return prisma.permission.upsert({
          where: { slug },
          update: {},
          create: { slug, resource, action },
        });
      }),
    );

    const role = await prisma.role.upsert({
      where: { key },
      update: { ...META[key] },
      create: { key, ...META[key] },
    });

    // Replace the grant set so the DB always mirrors permissions.ts.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    console.log(`${META[key].name}: ${permissions.length} permissions seeded.`);
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
