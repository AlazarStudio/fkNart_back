import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 📌 Список команд
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

    // ✅ обработка id: [1,2,3]
    if (filter.id && Array.isArray(filter.id)) {
      filter = { id: { in: filter.id.map(Number) } };
    }

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
      }),
      prisma.team.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `teams ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /teams:', err);
    res.status(500).json({ error: 'Ошибка загрузки команд' });
  }
});

// 📌 Одна команда
// 📌 Одна команда
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id },
      select: { id: true, title: true }, // ✅ только id и title
    });
    if (!team) return res.status(404).json({ error: 'Команда не найдена' });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения команды' });
  }
});

// 📌 Создать команду
router.post('/', async (req, res) => {
  try {
    const {
      title,
      city,
      logo = [],
      logoRaw = [],
      images = [],
      imagesRaw = [],
    } = req.body;

    // ✅ Конвертация любых объектов в строки
    const finalLogo = [...logo, ...logoRaw]
      .map((l) => (typeof l === 'string' ? l : l.src || ''))
      .filter(Boolean);

    const finalImages = [...images, ...imagesRaw]
      .map((i) => (typeof i === 'string' ? i : i.src || ''))
      .filter(Boolean);

    const created = await prisma.team.create({
      data: {
        title,
        city,
        logo: finalLogo,
        images: finalImages,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка создания команды:', err);
    res.status(500).json({ error: 'Ошибка создания команды' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title,
      city,
      logo = [],
      logoRaw = [],
      images = [],
      imagesRaw = [],
    } = req.body;

    const finalLogo = [...logo, ...logoRaw]
      .map((l) => (typeof l === 'string' ? l : l.src || ''))
      .filter(Boolean);

    const finalImages = [...images, ...imagesRaw]
      .map((i) => (typeof i === 'string' ? i : i.src || ''))
      .filter(Boolean);

    const updated = await prisma.team.update({
      where: { id },
      data: {
        title,
        city,
        logo: finalLogo,
        images: finalImages,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Ошибка обновления команды:', err);
    res.status(500).json({ error: 'Ошибка обновления команды' });
  }
});

// 📌 Удалить команду
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.team.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Ошибка удаления команды' });
  }
});

export default router;
