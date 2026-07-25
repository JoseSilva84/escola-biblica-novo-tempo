import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis;

const pool = globalForPrisma.prismaPool || new Pool({
  connectionString: process.env.DATABASE_URL
});

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter: new PrismaPg(pool)
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaPool = pool;
  globalForPrisma.prisma = prisma;
}
