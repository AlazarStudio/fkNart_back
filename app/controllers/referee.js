import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 9];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = range[0];
    const end = range[1];
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] = sort[1].toLowerCase();

    // ✅ нормализуем фильтры под Prisma
    const where = {};
    if (Array.isArray(filter.id)) {
      where.id = { in: filter.id.map(Number) };
    } else if (filter.id != null) {
      where.id = Number(filter.id);
    }
    if (filter.q) {
      where.name = { contains: filter.q, mode: 'insensitive' };
    }
    // можно поддержать и прямой фильтр по name
    if (filter.name) {
      where.name = { contains: filter.name, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.referee.findMany({
        skip: start,
        take,
        where,
        orderBy,
      }),
      prisma.referee.count({ where }),
    ]);

    res.setHeader(
      'Content-Range',
      `referees ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка загрузки судей' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.referee.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const created = await prisma.referee.create({ data: { name } });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка создания' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;
    const updated = await prisma.referee.update({
      where: { id },
      data: { name },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.referee.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

export default router;
