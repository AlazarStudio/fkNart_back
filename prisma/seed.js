// scripts/seedAdmin.js
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Запуск сидов...');

  const passwordHash = await hash('jnb9usdf98'); // ← хешируем

  // Лучше апсерт по login, если в схеме login UNIQUE
  await prisma.user.upsert({
    where: { login: 'admin' }, // <= ключ поиска совпадает с authUser
    update: {
      // если пользователь уже есть — обновим пароль на хеш
      password: passwordHash,
      email: 'admin@test.com',
      name: 'Admin',
    },
    create: {
      email: 'admin@test.com',
      login: 'nartAdmin',
      name: 'Admin',
      password: passwordHash, // <= сохраняем хеш
    },
  });

  console.log('✅ Админ готов');
}

main().finally(async () => {
  await prisma.$disconnect();
});
