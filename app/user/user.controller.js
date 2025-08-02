import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Все пользователи
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// Один пользователь
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

// Создать
router.post('/', async (req, res) => {
  try {
    const { email, login, name, password } = req.body;
    const created = await prisma.user.create({
      data: {
        email,
        login,
        name,
        password,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
});

// Обновить
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { email, login, name, password } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        email,
        login,
        name,
        password,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

// Удалить
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

export default router;
