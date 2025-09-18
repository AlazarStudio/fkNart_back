// app/controllers/match.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ---- helpers ----
const isGoalType = (type) => type === 'GOAL' || type === 'PENALTY_SCORED';

async function incrementStatTx(tx, playerId, type) {
  if (!playerId) return;
  await tx.playerStat.upsert({
    where: { playerId },
    update: {
      goals: isGoalType(type) ? { increment: 1 } : undefined,
      assists: type === 'ASSIST' ? { increment: 1 } : undefined,
      yellow_cards: type === 'YELLOW_CARD' ? { increment: 1 } : undefined,
      red_cards: type === 'RED_CARD' ? { increment: 1 } : undefined,
    },
    create: {
      playerId,
      matchesPlayed: 1,
      goals: isGoalType(type) ? 1 : 0,
      assists: type === 'ASSIST' ? 1 : 0,
      yellow_cards: type === 'YELLOW_CARD' ? 1 : 0,
      red_cards: type === 'RED_CARD' ? 1 : 0,
    },
  });
}

async function updateMatchScoreTx(tx, matchId) {
  const goals = await tx.matchEvent.findMany({
    where: { matchId, type: { in: ['GOAL', 'PENALTY_SCORED'] } },
    select: { teamId: true },
  });

  const match = await tx.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  let homeScore = 0;
  let guestScore = 0;
  for (const ev of goals) {
    if (ev.teamId === match.homeTeamId) homeScore++;
    else if (ev.teamId === match.guestTeamId) guestScore++;
  }

  await tx.match.update({
    where: { id: matchId },
    data: { homeScore, guestScore },
  });
}

// ---- Список матчей
router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 9];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    let filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = range[0];
    const end = range[1];
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] =
      String(sort[1]).toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (filter.id && Array.isArray(filter.id)) {
      filter = { id: { in: filter.id.map(Number) } };
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: {
          league: true,
          homeTeam: true,
          guestTeam: true,
          stadiumRel: true,
          matchReferees: {
            include: { referee: true },
            orderBy: [{ role: 'asc' }, { id: 'asc' }],
          },
          events: {
            include: { player: true, assist_player: true, team: true },
            orderBy: [{ half: 'asc' }, { minute: 'asc' }, { id: 'asc' }],
          },
          participants: {
            include: { player: { include: { team: true } } },
            orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
          },
        },
      }),
      prisma.match.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `matches ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /matches:', err);
    res.status(500).json({ error: 'Ошибка загрузки матчей' });
  }
});

// ---- Один матч
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        league: true,
        homeTeam: true,
        guestTeam: true,
        stadiumRel: true,
        matchReferees: {
          include: { referee: true },
          orderBy: [{ role: 'asc' }, { id: 'asc' }],
        },
        events: {
          include: { player: true, assist_player: true, team: true },
          orderBy: [{ half: 'asc' }, { minute: 'asc' }, { id: 'asc' }],
        },
        participants: {
          include: { player: { include: { team: true } } },
          orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!match) return res.status(404).json({ error: 'Матч не найден' });
    res.json(match);
  } catch (err) {
    console.error('Ошибка GET /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка получения матча' });
  }
});

// ---- Создать матч (+ events[], + matchReferees[])
router.post('/', async (req, res) => {
  try {
    const {
      date,
      status,
      homeScore = 0,
      guestScore = 0,
      round,
      leagueId,
      homeTeamId,
      guestTeamId,
      stadiumId,
      images = [],
      videos = [],
      events = [],
      matchReferees = [], // [{ refereeId, role }]
    } = req.body;

    const created = await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          date: new Date(date),
          status,
          homeScore,
          guestScore,
          round,
          leagueId: leagueId ? Number(leagueId) : null,
          homeTeamId: homeTeamId ? Number(homeTeamId) : null,
          guestTeamId: guestTeamId ? Number(guestTeamId) : null,
          stadiumId: stadiumId != null ? Number(stadiumId) : null,
          images,
          videos,
        },
      });

      // судьи матча
      if (Array.isArray(matchReferees) && matchReferees.length) {
        const data = matchReferees
          .filter((mr) => mr?.refereeId != null)
          .map((mr) => ({
            matchId: match.id,
            refereeId: Number(mr.refereeId),
            role: mr.role ?? null,
          }));
        if (data.length) {
          await tx.matchReferee.createMany({ data, skipDuplicates: true });
        }
      }

      // события
      if (Array.isArray(events) && events.length) {
        for (const e of events) {
          const createdEvent = await tx.matchEvent.create({
            data: {
              minute: e.minute ? Number(e.minute) : 0,
              half: e.half ? Number(e.half) : 1,
              type: e.type,
              description: e.description || '',
              playerId: e.playerId ? Number(e.playerId) : null,
              assistPlayerId: e.assistPlayerId
                ? Number(e.assistPlayerId)
                : null,
              teamId: Number(e.teamId),
              matchId: match.id,
            },
          });
          if (createdEvent.playerId) {
            await incrementStatTx(tx, createdEvent.playerId, createdEvent.type);
          }
          if (createdEvent.assistPlayerId && createdEvent.type === 'GOAL') {
            await incrementStatTx(tx, createdEvent.assistPlayerId, 'ASSIST');
          }
        }
        await updateMatchScoreTx(tx, match.id);
      }

      return tx.match.findUnique({
        where: { id: match.id },
        include: {
          homeTeam: true,
          guestTeam: true,
          league: true,
          stadiumRel: true,
          matchReferees: { include: { referee: true } },
          events: {
            include: { player: true, assist_player: true, team: true },
            orderBy: [{ half: 'asc' }, { minute: 'asc' }, { id: 'asc' }],
          },
          participants: {
            include: { player: { include: { team: true } } },
            orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка POST /matches:', err);
    res.status(500).json({ error: 'Ошибка создания матча' });
  }
});

// ---- Обновить матч (+ полная замена matchReferees при передаче массива)
router.put('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      date,
      status,
      homeScore = 0,
      guestScore = 0,
      round,
      leagueId,
      homeTeamId,
      guestTeamId,
      stadiumId,
      images = [],
      videos = [],
      events, // если массив — полная замена
      matchReferees, // если массив — полная замена
    } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id },
        data: {
          date: new Date(date),
          status,
          homeScore,
          guestScore,
          round,
          leagueId: leagueId ? Number(leagueId) : null,
          homeTeamId: homeTeamId ? Number(homeTeamId) : null,
          guestTeamId: guestTeamId ? Number(guestTeamId) : null,
          stadiumId: stadiumId != null ? Number(stadiumId) : null,
          images,
          videos,
        },
      });

      // Заменяем связи судей, если пришёл массив
      if (Array.isArray(matchReferees)) {
        await tx.matchReferee.deleteMany({ where: { matchId: id } });
        const data = matchReferees
          .filter((mr) => mr?.refereeId != null)
          .map((mr) => ({
            matchId: id,
            refereeId: Number(mr.refereeId),
            role: mr.role ?? null,
          }));
        if (data.length) {
          await tx.matchReferee.createMany({ data, skipDuplicates: true });
        }
      }

      // Полная замена событий
      if (Array.isArray(events)) {
        const oldEvents = await tx.matchEvent.findMany({
          where: { matchId: id },
        });

        for (const oe of oldEvents) {
          if (oe.playerId) {
            await tx.playerStat.updateMany({
              where: { playerId: oe.playerId },
              data: {
                goals: isGoalType(oe.type) ? { decrement: 1 } : undefined,
                assists: oe.type === 'ASSIST' ? { decrement: 1 } : undefined,
                yellow_cards:
                  oe.type === 'YELLOW_CARD' ? { decrement: 1 } : undefined,
                red_cards:
                  oe.type === 'RED_CARD' ? { decrement: 1 } : undefined,
              },
            });
          }
          if (oe.assistPlayerId && oe.type === 'GOAL') {
            await tx.playerStat.updateMany({
              where: { playerId: oe.assistPlayerId },
              data: { assists: { decrement: 1 } },
            });
          }
        }

        await tx.matchEvent.deleteMany({ where: { matchId: id } });

        for (const e of events) {
          const ne = await tx.matchEvent.create({
            data: {
              minute: e.minute ? Number(e.minute) : 0,
              half: e.half ? Number(e.half) : 1,
              type: e.type,
              description: e.description || '',
              playerId: e.playerId ? Number(e.playerId) : null,
              assistPlayerId: e.assistPlayerId
                ? Number(e.assistPlayerId)
                : null,
              teamId: Number(e.teamId),
              matchId: id,
            },
          });
          if (ne.playerId) await incrementStatTx(tx, ne.playerId, ne.type);
          if (ne.assistPlayerId && ne.type === 'GOAL') {
            await incrementStatTx(tx, ne.assistPlayerId, 'ASSIST');
          }
        }
        await updateMatchScoreTx(tx, id);
      }

      return tx.match.findUnique({
        where: { id },
        include: {
          homeTeam: true,
          guestTeam: true,
          league: true,
          stadiumRel: true,
          matchReferees: { include: { referee: true } },
          events: {
            include: { player: true, assist_player: true, team: true },
            orderBy: [{ half: 'asc' }, { minute: 'asc' }, { id: 'asc' }],
          },
          participants: {
            include: { player: { include: { team: true } } },
            orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    res.json(updated);
  } catch (err) {
    console.error('Ошибка PUT /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка обновления матча' });
  }
});

// ---- Удалить матч
router.delete('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      const events = await tx.matchEvent.findMany({ where: { matchId: id } });

      for (const ev of events) {
        if (ev.playerId) {
          await tx.playerStat.updateMany({
            where: { playerId: ev.playerId },
            data: {
              goals: isGoalType(ev.type) ? { decrement: 1 } : undefined,
              assists: ev.type === 'ASSIST' ? { decrement: 1 } : undefined,
              yellow_cards:
                ev.type === 'YELLOW_CARD' ? { decrement: 1 } : undefined,
              red_cards: ev.type === 'RED_CARD' ? { decrement: 1 } : undefined,
            },
          });
        }
        if (ev.assistPlayerId && ev.type === 'GOAL') {
          await tx.playerStat.updateMany({
            where: { playerId: ev.assistPlayerId },
            data: { assists: { decrement: 1 } },
          });
        }
      }

      await tx.matchEvent.deleteMany({ where: { matchId: id } });
      await tx.matchReferee.deleteMany({ where: { matchId: id } });
      await tx.playerMatch.deleteMany({ where: { matchId: id } }); // очищаем заявки
      await tx.match.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка DELETE /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка удаления матча' });
  }
});

export default router;
