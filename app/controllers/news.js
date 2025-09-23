// app/controllers/news.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/* ----------------- helpers ----------------- */
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

// принимает строку или объект {src|url|path}, приводит к массиву строк
const toStringArray = (val) => {
  const arr = Array.isArray(val) ? val : [val];
  return arr
    .filter(Boolean)
    .map((x) => {
      if (typeof x === 'string') return x;
      if (x?.src) return x.src;
      if (x?.url) return x.url;
      if (x?.path) return x.path;
      return '';
    })
    .filter((s) => typeof s === 'string' && s.length > 0);
};

const parseDateSafe = (date, fallback = new Date()) => {
  if (!date) return fallback;
  const d = new Date(date);
  return isNaN(d) ? fallback : d;
};

/* ----------------- GET /news -----------------
  Поддержка:
   1) ?_start=0&_end=9&order=asc&q=term
   2) ?range=[0,9]&sort=["date","desc"]&filter={"q":"term","id":[1,2],"dateFrom":"2024-01-01","dateTo":"2024-12-31"}
------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const range = safeParse(req.query.range, null);
    const sort = safeParse(req.query.sort, null);
    const filter = safeParse(req.query.filter, {});

    // пагинация
    const start = range ? toInt(range[0], 0) : toInt(req.query._start, 0);
    const end = range
      ? toInt(range[1], start + 9)
      : toInt(req.query._end, start + 9);
    const take = Math.max(0, end - start + 1);

    // поиск
    const q = (req.query.q ?? filter.q ?? '').toString().trim();

    // сортировка
    const allowedSortFields = new Set(['id', 'date', 'title']);
    let orderField = 'date';
    let orderDir = 'desc';

    if (Array.isArray(sort) && sort[0] && allowedSortFields.has(sort[0])) {
      orderField = sort[0];
      orderDir = (sort[1] || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    } else if (req.query.order) {
      orderField = 'date';
      orderDir =
        (req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    }

    // фильтры
    const where = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (Array.isArray(filter.id) && filter.id.length) {
      where.id = {
        in: filter.id.map((x) => Number(x)).filter((n) => Number.isFinite(n)),
      };
    }

    const dateFrom = filter.dateFrom ? new Date(filter.dateFrom) : null;
    const dateTo = filter.dateTo ? new Date(filter.dateTo) : null;
    if ((dateFrom && !isNaN(dateFrom)) || (dateTo && !isNaN(dateTo))) {
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
    console.error(
      '🔥 Ошибка News GET:',
      err?.code || '',
      err?.message || '',
      err?.meta || err
    );
    res.status(500).json({ error: 'Ошибка загрузки новостей' });
  }
});

/* ----------------- GET /news/:id ----------------- */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });

    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) return res.status(404).json({ error: 'Новость не найдена' });
    res.json(news);
  } catch (err) {
    console.error(
      '🔥 Ошибка News GET by ID:',
      err?.code || '',
      err?.message || '',
      err?.meta || err
    );
    res.status(500).json({ error: 'Ошибка получения новости' });
  }
});

/* ----------------- POST /news -----------------
  Принимает:
    title, description, date,
    images / imagesRaw,
    videos / videosRaw
------------------------------------------------ */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      images = [],
      imagesRaw = [],
      videos = [],
      videosRaw = [],
      date,
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title обязателен' });
    }

    const parsedDate = parseDateSafe(date, new Date());
    if (isNaN(parsedDate))
      return res.status(400).json({ error: 'Некорректная дата' });

    const imagesFinal = toStringArray([...images, ...imagesRaw]);
    const videosFinal = toStringArray([...videos, ...videosRaw]);

    const created = await prisma.news.create({
      data: {
        title,
        description,
        date: parsedDate,
        images: imagesFinal,
        videos: videosFinal, // требуется поле videos в Prisma-модели
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error(
      '🔥 Ошибка News POST:',
      err?.code || '',
      err?.message || '',
      err?.meta || err,
      {
        body: req.body,
      }
    );
    res.status(500).json({ error: 'Ошибка создания новости' });
  }
});

/* ----------------- PUT /news/:id -----------------
  Полное обновление полей; images/videos собираются из базовых и *Raw
--------------------------------------------------- */
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });

    const exists = await prisma.news.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Новость не найдена' });

    const {
      title,
      description,
      images = [],
      imagesRaw = [],
      videos = [],
      videosRaw = [],
      date,
    } = req.body;

    const parsedDate = parseDateSafe(date, exists.date);
    if (parsedDate && isNaN(parsedDate))
      return res.status(400).json({ error: 'Некорректная дата' });

    const updatedImages = toStringArray([...images, ...imagesRaw]);
    const updatedVideos = toStringArray([...videos, ...videosRaw]);

    const updated = await prisma.news.update({
      where: { id },
      data: {
        title,
        description,
        date: parsedDate,
        images: updatedImages,
        videos: updatedVideos, // требуется поле videos в Prisma-модели
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(
      '🔥 Ошибка News PUT:',
      err?.code || '',
      err?.message || '',
      err?.meta || err,
      {
        body: req.body,
      }
    );
    res.status(500).json({ error: 'Ошибка обновления новости' });
  }
});

/* ----------------- DELETE /news/:id ----------------- */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
      return res.status(400).json({ error: 'Некорректный ID' });

    await prisma.news.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(
      '🔥 Ошибка News DELETE:',
      err?.code || '',
      err?.message || '',
      err?.meta || err
    );
    res.status(500).json({ error: 'Ошибка удаления новости' });
  }
});

export default router;
