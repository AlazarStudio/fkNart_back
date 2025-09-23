// app/controllers/player.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Список игроков
router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 999];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    const rawFilter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const [start, end] = range;
    const take = Math.max(0, end - start + 1);

    const orderBy = {
      [sort[0]]: String(sort[1]).toLowerCase() === 'desc' ? 'desc' : 'asc',
    };

    const AND = [];

    if (Array.isArray(rawFilter.id)) {
      const ids = rawFilter.id.map(Number).filter(Number.isFinite);
      if (ids.length) AND.push({ id: { in: ids } });
    }

    if (rawFilter.teamId != null) {
      const teamId = Number(rawFilter.teamId);
      if (Number.isFinite(teamId)) AND.push({ teamId });
    }

    if (typeof rawFilter.q === 'string' && rawFilter.q.trim()) {
      AND.push({ name: { contains: rawFilter.q.trim(), mode: 'insensitive' } });
    }

    if (typeof rawFilter.position === 'string' && rawFilter.position.trim()) {
      AND.push({ position: rawFilter.position.trim() });
    }

    const where = AND.length ? { AND } : undefined;

    const [data, total] = await Promise.all([
      prisma.player.findMany({
        skip: start,
        take,
        where,
        orderBy,
        include: { team: true },
      }),
      prisma.player.count({ where }),
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
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный id' });

    const player = await prisma.player.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    res.json(player);
  } catch (err) {
    console.error('Ошибка GET /players/:id:', err);
    res.status(500).json({ error: 'Ошибка получения игрока' });
  }
});

// 📌 Создать игрока
router.post('/', async (req, res) => {
  try {
    let { name, position, number, birthDate, teamId, images = [] } = req.body;

    images = Array.isArray(images)
      ? images
          .map((i) => (typeof i === 'string' ? i : i?.src || ''))
          .filter(Boolean)
      : [];

    const num = Number(number);
    const tId = Number(teamId);

    const created = await prisma.player.create({
      data: {
        name,
        position,
        number: Number.isFinite(num) ? num : null, // ← nullable
        birthDate: birthDate ? new Date(birthDate) : new Date(),
        teamId: Number.isFinite(tId) ? tId : undefined,
        images,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка создания игрока:', err);
    res.status(500).json({ error: 'Ошибка создания игрока' });
  }
});

// 📌 Обновить игрока
router.put('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный id' });

    let { name, position, number, birthDate, teamId, images = [] } = req.body;

    images = Array.isArray(images)
      ? images
          .map((i) => (typeof i === 'string' ? i : i?.src || ''))
          .filter(Boolean)
      : [];

    const num = Number(number);
    const tId = Number(teamId);

    const updated = await prisma.player.update({
      where: { id },
      data: {
        name,
        position,
        number: Number.isFinite(num) ? num : null, // ← nullable
        birthDate: birthDate ? new Date(birthDate) : new Date(),
        teamId: Number.isFinite(tId) ? tId : undefined,
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
router.delete('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный id' });

    await prisma.player.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления игрока:', err);
    res.status(500).json({ error: 'Ошибка удаления игрока' });
  }
});

export default router;
