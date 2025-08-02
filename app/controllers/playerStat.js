import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Все записи статистики
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

    if (filter.id && Array.isArray(filter.id)) {
      filter = { id: { in: filter.id.map(Number) } };
    }

    const [data, total] = await Promise.all([
      prisma.playerStat.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: { player: true },
      }),
      prisma.playerStat.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `playerStats ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /playerStats:', err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

// 📌 Получить одну запись
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stat = await prisma.playerStat.findUnique({
      where: { id },
      include: { player: true },
    });

    if (!stat) return res.status(404).json({ message: 'Not found' });
    res.json(stat);
  } catch (err) {
    console.error('Ошибка GET /playerStats/:id:', err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

// 📌 Создать статистику
router.post('/', async (req, res) => {
  try {
    const { playerId, goals, assists, yellow_cards, red_cards } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId обязателен' });
    }

    const created = await prisma.playerStat.create({
      data: {
        playerId: Number(playerId),
        matchesPlayed: 1,
        goals: goals || 0,
        assists: assists || 0,
        yellow_cards: yellow_cards || 0,
        red_cards: red_cards || 0,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка POST /playerStats:', err);
    res.status(500).json({ error: 'Ошибка создания статистики' });
  }
});

// 📌 Обновить статистику
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { goals, assists, yellow_cards, red_cards, matchesPlayed } = req.body;

    const updated = await prisma.playerStat.update({
      where: { id },
      data: {
        goals: Number(goals) || 0,
        assists: Number(assists) || 0,
        yellow_cards: Number(yellow_cards) || 0,
        red_cards: Number(red_cards) || 0,
        matchesPlayed: Number(matchesPlayed) || 0,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Ошибка PUT /playerStats:', err);
    res
      .status(500)
      .json({ error: 'Ошибка обновления статистики', details: err.message });
  }
});

// 📌 Удалить статистику
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.playerStat.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка DELETE /playerStats:', err);
    res.status(500).json({ error: 'Ошибка удаления статистики' });
  }
});

export default router;
