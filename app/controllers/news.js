import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// --- helpers ---
const safeParse = (val, fallback) => {
  try {
    if (typeof val !== 'string') return fallback;
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const toInt = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

// --- GET /news  (пагинация, сортировка, фильтрация, поиск) ---
router.get('/', async (req, res) => {
  try {
    // Поддержка двух стилей:
    // 1) ?_start=0&_end=10&order=asc&q=term
    // 2) ?range=[0,9]&sort=["date","desc"]&filter={"q":"term","id":[1,2],"dateFrom":"2024-01-01","dateTo":"2024-12-31"}
    const range = safeParse(req.query.range, null);
    const sort = safeParse(req.query.sort, null);
    const filter = safeParse(req.query.filter, {});

    // --- Пагинация
    const hasStartEnd =
      req.query._start !== undefined || req.query._end !== undefined;
    const start = range ? toInt(range[0], 0) : toInt(req.query._start, 0);
    const end = range
      ? toInt(range[1], start + 9)
      : toInt(req.query._end, start + 9);
    const take = Math.max(0, end - start + 1);

    // --- Поиск
    // поддерживаем q из query (?q=...) и из filter.q
    const q = (req.query.q ?? filter.q ?? '').toString().trim();

    // --- Сортировка (разрешённые поля)
    const allowedSortFields = new Set(['id', 'date', 'title']);
    let orderField = 'id';
    let orderDir = 'asc';

    if (Array.isArray(sort) && sort[0] && allowedSortFields.has(sort[0])) {
      orderField = sort[0];
      orderDir = (sort[1] || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    } else if (req.query.order) {
      // если пришёл простой order (asc/desc), сортируем по date
      orderField = 'date';
      orderDir =
        (req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    } else {
      // по умолчанию — новые сначала
      orderField = 'date';
      orderDir = 'desc';
    }

    // --- Фильтры
    const where = {};

    // поиск по title/description
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // фильтр по id: { id: [1,2,3] }
    if (Array.isArray(filter.id) && filter.id.length) {
      where.id = {
        in: filter.id.map((x) => Number(x)).filter((n) => Number.isFinite(n)),
      };
    }

    // фильтр по диапазону дат: { dateFrom: '2024-01-01', dateTo: '2024-12-31' }
    const dateFrom = filter.dateFrom ? new Date(filter.dateFrom) : null;
    const dateTo = filter.dateTo ? new Date(filter.dateTo) : null;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom && !isNaN(dateFrom)) where.date.gte = dateFrom;
      if (dateTo && !isNaN(dateTo)) where.date.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip: start,
        take,
        orderBy: { [orderField]: orderDir },
      }),
      prisma.news.count({ where }),
    ]);

    res.setHeader(
      'Content-Range',
      `news ${start}-${start + items.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(items);
  } catch (err) {
    console.error('🔥 Ошибка News GET:', err);
    res.status(500).json({ error: 'Ошибка загрузки новостей' });
  }
});

// --- GET /news/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });

    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) return res.status(404).json({ error: 'Новость не найдена' });
    res.json(news);
  } catch (err) {
    console.error('🔥 Ошибка News GET by ID:', err);
    res.status(500).json({ error: 'Ошибка получения новости' });
  }
});

// --- POST /news
router.post('/', async (req, res) => {
  try {
    const { title, description, images = [], videos = [], date } = req.body;

    const parsedDate = date ? new Date(date) : new Date();
    if (isNaN(parsedDate))
      return res.status(400).json({ error: 'Некорректная дата' });

    const created = await prisma.news.create({
      data: {
        title,
        description,
        date: parsedDate,
        images: Array.isArray(images) ? images : [images].filter(Boolean),
        videos: Array.isArray(videos) ? videos : [videos].filter(Boolean),
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('🔥 Ошибка News POST:', err);
    res.status(500).json({ error: 'Ошибка создания новости' });
  }
});

// --- PUT /news/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });
    const {
      title,
      description,
      images = [],
      imagesRaw = [],
      videos = [],
      videosRaw = [],
      date,
    } = req.body;

    const exists = await prisma.news.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Новость не найдена' });

    const parsedDate = date ? new Date(date) : exists.date;
    if (parsedDate && isNaN(parsedDate))
      return res.status(400).json({ error: 'Некорректная дата' });

    const updatedImages = [
      ...(Array.isArray(images) ? images : [images]),
      ...(Array.isArray(imagesRaw) ? imagesRaw : []),
    ].filter(Boolean);

    const updatedVideos = [
      ...(Array.isArray(videos) ? videos : [videos]),
      ...(Array.isArray(videosRaw) ? videosRaw : []),
    ].filter(Boolean);

    const updated = await prisma.news.update({
      where: { id },
      data: {
        title,
        description,
        date: parsedDate,
        images: updatedImages,
        videos: updatedVideos,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('🔥 Ошибка News PUT:', err);
    res.status(500).json({ error: 'Ошибка обновления новости' });
  }
});

// --- DELETE /news/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });

    await prisma.news.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('🔥 Ошибка News DELETE:', err);
    res.status(500).json({ error: 'Ошибка удаления новости' });
  }
});

export default router;
