import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../auth.js';

const email = String(process.env.ADMIN_EMAIL || 'admin@leadsnt.com.br').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const name = String(process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL nao configurado.');
  process.exit(1);
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash: hashPassword(password),
      role: 'ADMIN_GERAL',
      associationId: null
    },
    create: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'ADMIN_GERAL'
    }
  });

  console.log(`Admin pronto: ${user.email}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
