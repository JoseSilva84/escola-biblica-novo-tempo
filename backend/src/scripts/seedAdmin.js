import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../auth.js';

const email = String(process.env.ADMIN_EMAIL || 'admin@leadsnt.com.br').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const name = String(process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';
const paulistanaEmail = String(process.env.PAULISTANA_EMAIL || 'paulistana@leadsnt.com.br').trim().toLowerCase();
const paulistanaPassword = String(process.env.PAULISTANA_PASSWORD || '');
const paulistanaUserName = String(process.env.PAULISTANA_USER_NAME || 'Associacao Paulistana').trim() || 'Associacao Paulistana';
const paulistanaName = String(process.env.PAULISTANA_ASSOCIATION_NAME || 'Associacao Paulistana').trim() || 'Associacao Paulistana';
const paulistanaSlug = String(process.env.PAULISTANA_ASSOCIATION_SLUG || 'paulistana').trim().toLowerCase() || 'paulistana';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL nao configurado.');
  process.exit(1);
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

if (paulistanaPassword.length < 8) {
  console.error('PAULISTANA_PASSWORD precisa ter pelo menos 8 caracteres.');
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

  const paulistana = await prisma.association.upsert({
    where: { slug: paulistanaSlug },
    update: {
      name: paulistanaName
    },
    create: {
      name: paulistanaName,
      slug: paulistanaSlug
    }
  });

  const paulistanaUser = await prisma.user.upsert({
    where: { email: paulistanaEmail },
    update: {
      name: paulistanaUserName,
      passwordHash: hashPassword(paulistanaPassword),
      role: 'GESTOR_ASSOCIACAO',
      associationId: paulistana.id
    },
    create: {
      name: paulistanaUserName,
      email: paulistanaEmail,
      passwordHash: hashPassword(paulistanaPassword),
      role: 'GESTOR_ASSOCIACAO',
      associationId: paulistana.id
    }
  });

  console.log(`Acesso Paulistana pronto: ${paulistanaUser.email} -> ${paulistana.name}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
