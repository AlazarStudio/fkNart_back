import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Список игроков
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
      prisma.player.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: { team: true },
      }),
      prisma.player.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `players ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /players:', err);
    res.status(500).json({ error: 'Ошибка загрузки игроков' });
  }
});

// 📌 Один игрок
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const player = await prisma.player.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения игрока' });
  }
});

// 📌 Создать игрока
router.post('/', async (req, res) => {
  try {
    let { name, position, number, birthDate, teamId, images = [] } = req.body;

    images = Array.isArray(images)
      ? images
          .map((i) => (typeof i === 'string' ? i : i.src || ''))
          .filter(Boolean)
      : [];

    const created = await prisma.player.create({
      data: {
        name,
        position,
        number: Number(number),
        birthDate: birthDate ? new Date(birthDate) : new Date(), // ✅ фикс
        teamId: Number(teamId),
        images,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка создания игрока:', err);
    res.status(500).json({ error: 'Ошибка создания игрока' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let { name, position, number, birthDate, teamId, images = [] } = req.body;

    images = Array.isArray(images)
      ? images
          .map((i) => (typeof i === 'string' ? i : i.src || ''))
          .filter(Boolean)
      : [];

    const updated = await prisma.player.update({
      where: { id },
      data: {
        name,
        position,
        number: Number(number),
        birthDate: birthDate ? new Date(birthDate) : new Date(),
        teamId: Number(teamId),
        images,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Ошибка обновления игрока:', err);
    res.status(500).json({ error: 'Ошибка обновления игрока' });
  }
});

// 📌 Удалить игрока
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.player.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления игрока' });
  }
});

export default router;
