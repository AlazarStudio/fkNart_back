import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Список матчей
router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 9];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    let filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = range[0];
    const end = range[1];
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] = sort[1].toLowerCase();

    // ✅ ReferenceInput fix
    if (filter.id && Array.isArray(filter.id)) {
      filter = { id: { in: filter.id.map(Number) } };
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: { league: true, homeTeam: true, guestTeam: true },
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

// 📌 Один матч
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        league: true,
        homeTeam: true,
        guestTeam: true,
        // Удали или замени на реальные связи
        // events: true,
        // player_stats: true,
      },
    });

    if (!match) return res.status(404).json({ error: 'Матч не найден' });
    res.json(match);
  } catch (err) {
    console.error('Ошибка GET /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка получения матча' });
  }
});

// 📌 Создать матч
router.post('/', async (req, res) => {
  try {
    const {
      stadium,
      date,
      status,
      homeScore,
      guestScore,
      round,
      leagueId,
      homeTeamId,
      guestTeamId,
      images = [],
      videos = [],
    } = req.body;

    const created = await prisma.match.create({
      data: {
        stadium,
        date: new Date(date),
        status,
        homeScore,
        guestScore,
        round,
        leagueId: leagueId ? Number(leagueId) : null,
        homeTeamId: homeTeamId ? Number(homeTeamId) : null,
        guestTeamId: guestTeamId ? Number(guestTeamId) : null,
        images,
        videos,
      },
      include: { homeTeam: true, guestTeam: true, league: true },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка POST /matches:', err);
    res.status(500).json({ error: 'Ошибка создания матча' });
  }
});

// 📌 Обновить матч
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      stadium,
      date,
      status,
      homeScore,
      guestScore,
      round,
      leagueId,
      homeTeamId,
      guestTeamId,
      images = [],
      videos = [],
    } = req.body;

    const updated = await prisma.match.update({
      where: { id },
      data: {
        stadium,
        date: new Date(date),
        status,
        homeScore,
        guestScore,
        round,
        leagueId: leagueId ? Number(leagueId) : null,
        homeTeamId: homeTeamId ? Number(homeTeamId) : null,
        guestTeamId: guestTeamId ? Number(guestTeamId) : null,
        images,
        videos,
      },
      include: { homeTeam: true, guestTeam: true, league: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('Ошибка PUT /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка обновления матча' });
  }
});

// 📌 Удалить матч
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.match.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка DELETE /matches/:id:', err);
    res.status(500).json({ error: 'Ошибка удаления матча' });
  }
});

export default router;
