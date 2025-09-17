import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 9];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = Number(range[0]);
    const end = Number(range[1]);
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] = (sort[1] || 'ASC').toLowerCase();

    // ✅ нормализуем фильтр под Prisma
    const where = {};

    // id / [id]
    if (Array.isArray(filter.id)) {
      const ids = filter.id
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n));
      where.id = ids.length ? { in: ids } : -1; // -1 гарантирует "пустой" результат
    } else if (filter.id != null) {
      const id = Number(filter.id);
      if (!Number.isNaN(id)) where.id = id;
    }

    // q-поиск по name/location
    if (filter.q) {
      const q = String(filter.q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    // прямые фильтры
    if (filter.name) {
      where.name = { contains: String(filter.name), mode: 'insensitive' };
    }
    if (filter.location) {
      where.location = {
        contains: String(filter.location),
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      prisma.stadium.findMany({
        skip: start,
        take,
        where,
        orderBy,
      }),
      prisma.stadium.count({ where }),
    ]);

    res.setHeader(
      'Content-Range',
      `stadiums ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (e) {
    console.error('Ошибка загрузки стадионов:', e);
    res.status(500).json({ error: 'Ошибка загрузки стадионов' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.stadium.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    console.error('Ошибка получения стадиона:', e);
    res.status(500).json({ error: 'Ошибка' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, location } = req.body;
    const created = await prisma.stadium.create({
      data: { name, location: location ?? null },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error('Ошибка создания стадиона:', e);
    res.status(500).json({ error: 'Ошибка создания' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, location } = req.body;
    const updated = await prisma.stadium.update({
      where: { id },
      data: { name, location: location ?? null },
    });
    res.json(updated);
  } catch (e) {
    console.error('Ошибка обновления стадиона:', e);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.stadium.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка удаления стадиона:', e);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

export default router;
