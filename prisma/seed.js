import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Запуск сидов...');

  // ✅ Создаём пользователя-админа
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      login: 'admin',
      name: 'Admin',
      password: 'admin123', // хешируй в проде
    },
  });

  // ✅ Лига
  const league = await prisma.league.create({
    data: {
      title: 'Nart League',
      season: '2025',
      city: 'Nalchik',
      images: ['/uploads/league-logo.webp'],
    },
  });

  // ✅ Команды
  const team1 = await prisma.team.create({
    data: {
      title: 'FC Eagles',
      city: 'Nalchik',
      logo: ['/uploads/team1-logo.webp'],
    },
  });

  const team2 = await prisma.team.create({
    data: {
      title: 'FC Wolves',
      city: 'Cherkessk',
      logo: ['/uploads/team2-logo.webp'],
    },
  });

  // ✅ Игроки
  const player1 = await prisma.player.create({
    data: {
      name: 'Aslan Bekov',
      position: 'Forward',
      number: 9,
      birthDate: new Date('2000-05-12'),
      teamId: team1.id,
    },
  });

  const player2 = await prisma.player.create({
    data: {
      name: 'Murad Ibragimov',
      position: 'Goalkeeper',
      number: 1,
      birthDate: new Date('1998-11-20'),
      teamId: team2.id,
    },
  });

  // ✅ Матч
  const match = await prisma.match.create({
    data: {
      stadium: 'Central Stadium',
      date: new Date(),
      status: 'SCHEDULED',
      homeScore: 0,
      guestScore: 0,
      round: 1,
      leagueId: league.id,
    },
  });

  // ✅ Событие матча
  await prisma.matchEvent.create({
    data: {
      minute: 15,
      half: 1,
      type: 'GOAL',
      description: 'First goal!',
      playerId: player1.id,
      teamId: team1.id,
      matchId: match.id,
    },
  });

  // ✅ Статистика игрока
  await prisma.playerStat.create({
    data: {
      goals: 1,
      assists: 0,
      playerId: player1.id,
      matchId: match.id,
    },
  });

  // ✅ Партнёр
  await prisma.partner.create({
    data: {
      name: 'SportShop',
      images: ['/uploads/partner-logo.webp'],
      link: 'https://sportshop.com',
    },
  });

  console.log('✅ Сиды завершены!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
