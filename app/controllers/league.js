import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Получить все лиги (с пагинацией и сортировкой для React Admin)
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

    // ✅ Обработка фильтра id: [x, y, z]
    if (filter.id && Array.isArray(filter.id)) {
      filter = { ...filter, id: { in: filter.id.map(Number) } };
    }

    const [data, total] = await Promise.all([
      prisma.league.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
      }),
      prisma.league.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `leagues ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки лиг' });
  }
});

// 📌 Получить одну лигу по ID
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Лига не найдена' });
    res.json(league);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения лиги' });
  }
});

// 📌 Создать лигу
router.post('/', async (req, res) => {
  try {
    const { title, season, city, images = [] } = req.body;

    const created = await prisma.league.create({
      data: {
        title,
        season,
        city,
        images: Array.isArray(images) ? images : [images],
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания лиги' });
  }
});

// 📌 Обновить лигу
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, season, city, images = [], imagesRaw = [] } = req.body;

    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) return res.status(404).json({ error: 'Лига не найдена' });

    // объединяем старые и новые
    const updatedImages = [
      ...(Array.isArray(images) ? images : []),
      ...(Array.isArray(imagesRaw) ? imagesRaw : []),
    ];

    const updated = await prisma.league.update({
      where: { id },
      data: {
        title,
        season,
        city,
        images: updatedImages,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления лиги' });
  }
});

// 📌 Удалить лигу
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.league.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления лиги' });
  }
});

export default router;
