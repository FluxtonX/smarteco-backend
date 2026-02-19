import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env file so CLI commands (migrate, generate) can access DATABASE_URL
dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
    schema: path.join(__dirname, 'src', 'database', 'prisma', 'schema.prisma'),
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
