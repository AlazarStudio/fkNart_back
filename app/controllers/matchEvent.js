import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// утилита: гол = обычный гол или забитый пенальти
const isGoalType = (type) => type === 'GOAL' || type === 'PENALTY_SCORED';

// ✅ инкремент статистики игрока (общая по игроку)
async function incrementStat(playerId, type) {
  await prisma.playerStat.upsert({
    where: { playerId },
    update: {
      matchesPlayed: { increment: 0 },
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

// ✅ декремент статистики игрока
async function decrementStat(playerId, type) {
  await prisma.playerStat.updateMany({
    where: { playerId },
    data: {
      goals: isGoalType(type) ? { decrement: 1 } : undefined,
      assists: type === 'ASSIST' ? { decrement: 1 } : undefined,
      yellow_cards: type === 'YELLOW_CARD' ? { decrement: 1 } : undefined,
      red_cards: type === 'RED_CARD' ? { decrement: 1 } : undefined,
    },
  });
}

// ✅ пересчёт счёта матча (гол + реализованный пенальти)
async function updateMatchScore(matchId) {
  const goals = await prisma.matchEvent.findMany({
    where: { matchId, type: { in: ['GOAL', 'PENALTY_SCORED'] } },
    include: { team: true },
  });

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  let homeScore = 0;
  let guestScore = 0;

  goals.forEach((ev) => {
    if (ev.teamId === match.homeTeamId) homeScore++;
    if (ev.teamId === match.guestTeamId) guestScore++;
  });

  await prisma.match.update({
    where: { id: matchId },
    data: { homeScore, guestScore },
  });
}

// 🔹 GET /api/matchEvents
router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 9999];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = range[0];
    const end = range[1];
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] = sort[1].toLowerCase();

    const [data, total] = await Promise.all([
      prisma.matchEvent.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: {
          player: true,
          assist_player: true,
          team: true,
          match: true,
        },
      }),
      prisma.matchEvent.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `matchEvents ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /matchEvents:', err);
    res.status(500).json({ error: 'Ошибка загрузки событий' });
  }
});

// 🔹 GET /api/matchEvents/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.matchEvent.findUnique({
      where: { id },
      include: {
        player: true,
        assist_player: true,
        team: true,
        match: true,
      },
    });

    if (!event) return res.status(404).json({ message: 'Not found' });
    res.json(event);
  } catch (err) {
    console.error('Ошибка GET /matchEvents/:id:', err);
    res.status(500).json({ error: 'Ошибка загрузки события' });
  }
});

// 🔹 POST /api/matchEvents
router.post('/', async (req, res) => {
  try {
    const {
      minute,
      half,
      type,
      description,
      playerId,
      assistPlayerId,
      teamId,
      matchId,
    } = req.body;

    if (!matchId || !teamId) {
      return res.status(400).json({ error: 'matchId и teamId обязательны' });
    }

    const created = await prisma.matchEvent.create({
      data: {
        minute: minute ? Number(minute) : 0,
        half: half ? Number(half) : 1,
        type,
        description: description || '',
        playerId: playerId ? Number(playerId) : null,
        assistPlayerId: assistPlayerId ? Number(assistPlayerId) : null,
        teamId: Number(teamId),
        matchId: Number(matchId),
      },
      include: { player: true, team: true, match: true },
    });

    if (playerId) await incrementStat(Number(playerId), type);

    // ассист считаем только для обычного гола
    if (assistPlayerId && type === 'GOAL') {
      await incrementStat(Number(assistPlayerId), 'ASSIST');
    }

    if (isGoalType(type)) {
      await updateMatchScore(Number(matchId));
    }

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка POST /matchEvents:', err.message, err);
    res
      .status(500)
      .json({ error: 'Ошибка создания события', details: err.message });
  }
});

// 🔹 PUT /api/matchEvents/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      minute,
      half,
      type,
      description,
      playerId,
      assistPlayerId,
      teamId,
    } = req.body;

    const oldEvent = await prisma.matchEvent.findUnique({ where: { id } });
    if (!oldEvent) return res.status(404).json({ error: 'Событие не найдено' });

    // снять старые инкременты
    if (oldEvent.playerId)
      await decrementStat(oldEvent.playerId, oldEvent.type);
    if (oldEvent.assistPlayerId && oldEvent.type === 'GOAL') {
      await decrementStat(oldEvent.assistPlayerId, 'ASSIST');
    }

    const updated = await prisma.matchEvent.update({
      where: { id },
      data: {
        minute: Number(minute),
        half: Number(half),
        type,
        description,
        playerId: playerId ? Number(playerId) : null,
        assistPlayerId: assistPlayerId ? Number(assistPlayerId) : null,
        teamId: Number(teamId),
      },
      include: { player: true, team: true, match: true },
    });

    // применить новые инкременты
    if (playerId) await incrementStat(Number(playerId), type);
    if (assistPlayerId && type === 'GOAL') {
      await incrementStat(Number(assistPlayerId), 'ASSIST');
    }

    // пересчитать счёт, если тип/старый тип — гол
    if (isGoalType(type) || isGoalType(oldEvent.type)) {
      await updateMatchScore(updated.matchId);
    }

    res.json(updated);
  } catch (err) {
    console.error('Ошибка PUT /matchEvents:', err.message, err);
    res
      .status(500)
      .json({ error: 'Ошибка обновления события', details: err.message });
  }
});

// 🔹 DELETE /api/matchEvents/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const oldEvent = await prisma.matchEvent.findUnique({ where: { id } });

    if (!oldEvent) return res.status(404).json({ error: 'Событие не найдено' });

    await prisma.matchEvent.delete({ where: { id } });

    if (oldEvent.playerId)
      await decrementStat(oldEvent.playerId, oldEvent.type);
    if (oldEvent.assistPlayerId && oldEvent.type === 'GOAL') {
      await decrementStat(oldEvent.assistPlayerId, 'ASSIST');
    }
    if (isGoalType(oldEvent.type)) await updateMatchScore(oldEvent.matchId);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка DELETE /matchEvents:', err.message, err);
    res
      .status(500)
      .json({ error: 'Ошибка удаления события', details: err.message });
  }
});

export default router;
