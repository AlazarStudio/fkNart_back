// prisma/seed.js  (CommonJS)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Задай пароль через переменную окружения, иначе будет дефолтный
  const plain = process.env.SEED_ADMIN_PASS || 'kjshdf8!hdei!!00';
  const hash = await bcrypt.hash(plain, 10);

  // upsert по уникальному email
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nart.local' },
    update: {
      name: 'Админ',
      login: 'adminNart',
      password: hash,
    },
    create: {
      email: 'admin@nart.local',
      login: 'adminNart',
      name: 'Админ',
      password: hash,
    },
  });

  console.log('✅ user seeded:', {
    id: admin.id,
    email: admin.email,
    login: admin.login,
  });
  console.log(
    'ℹ️ admin password:',
    plain,
    '(можно задать через SEED_ADMIN_PASS)'
  );
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
