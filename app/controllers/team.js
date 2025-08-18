import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const safeJSON = (v, fb) => {
  try {
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};
const toInt = (v) =>
  v === '' || v === null || v === undefined ? undefined : Number(v);

/* ===================== LIST ===================== */
// GET /teams?range=[0,9]&sort=["id","ASC"]&filter={"q":"...","city":"...","title":"...", "id":[1,2]}
router.get('/', async (req, res) => {
  try {
    const range = safeJSON(req.query.range, [0, 9]);
    const sort = safeJSON(req.query.sort, ['id', 'ASC']);
    const filter = safeJSON(req.query.filter, {});

    const [start, end] = range;
    const take = Math.max(0, end - start + 1);

    const [sortField, sortOrderRaw] = sort;
    const sortOrder =
      String(sortOrderRaw).toLowerCase() === 'desc' ? 'desc' : 'asc';
    const orderBy = { [sortField]: sortOrder };

    const AND = [];

    // id: [1,2,3]
    if (Array.isArray(filter.id)) {
      const ids = filter.id.map(Number).filter(Number.isFinite);
      if (ids.length) AND.push({ id: { in: ids } });
    }

    // title: contains (insensitive) — удобно для поиска "Нарт"
    if (typeof filter.title === 'string' && filter.title.trim()) {
      AND.push({
        title: { contains: filter.title.trim(), mode: 'insensitive' },
      });
    }

    // q: общий поиск по названию/городу
    if (typeof filter.q === 'string' && filter.q.trim()) {
      const q = filter.q.trim();
      AND.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    // city: contains (insensitive)
    if (typeof filter.city === 'string' && filter.city.trim()) {
      AND.push({ city: { contains: filter.city.trim(), mode: 'insensitive' } });
    }

    const where = AND.length ? { AND } : undefined;

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        skip: start,
        take,
        where,
        orderBy,
      }),
      prisma.team.count({ where }),
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

/* ===== удобные доп. роуты (ВАЖНО: до "/:id") ===== */

// /teams/by-title/Нарт — регистронезависимый поиск по точному названию
router.get('/by-title/:title', async (req, res) => {
  try {
    const { title } = req.params;
    const team = await prisma.team.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
    });
    if (!team) return res.status(404).json({ error: 'Команда не найдена' });
    res.json(team);
  } catch (err) {
    console.error('Ошибка GET /teams/by-title/:title:', err);
    res.status(500).json({ error: 'Ошибка поиска команды' });
  }
});

// /teams/:id/stats — агрегированная статистика из LeagueStanding (fallback: Team)
router.get('/:id/stats', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return res.status(404).json({ error: 'Команда не найдена' });

    const rows = await prisma.leagueStanding.findMany({
      where: { team_id: id },
    });

    if (rows.length) {
      const games = rows.reduce((s, r) => s + (r.played ?? 0), 0);
      const wins = rows.reduce((s, r) => s + (r.wins ?? 0), 0);
      const goals = rows.reduce((s, r) => s + (r.goals_for ?? 0), 0);
      const tournaments = new Set(rows.map((r) => r.league_id)).size;
      return res.json({
        games,
        wins,
        goals,
        tournaments,
        source: 'standings',
      });
    }

    return res.json({
      games: team.games ?? 0,
      wins: team.wins ?? 0,
      goals: team.goals ?? 0,
      tournaments: team.tournaments ?? 0,
      source: 'team',
    });
  } catch (err) {
    console.error('Ошибка GET /teams/:id/stats:', err);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

/* ===================== ITEM ===================== */

// GET /teams/:id — возвращаем все поля (без select), чтобы редактор видел текущие значения
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return res.status(404).json({ error: 'Команда не найдена' });
    res.json(team);
  } catch (err) {
    console.error('Ошибка GET /teams/:id:', err);
    res.status(500).json({ error: 'Ошибка получения команды' });
  }
});

/* ===================== CRUD ===================== */

// POST /teams — создаём (учитываем статистику, если пришла)
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

    const finalLogo = [...logo, ...logoRaw]
      .map((l) => (typeof l === 'string' ? l : l?.src || ''))
      .filter(Boolean);

    const finalImages = [...images, ...imagesRaw]
      .map((i) => (typeof i === 'string' ? i : i?.src || ''))
      .filter(Boolean);

    const data = {
      title,
      city,
      logo: finalLogo,
      images: finalImages,
    };

    // опциональные числовые поля
    const games = toInt(req.body.games);
    const wins = toInt(req.body.wins);
    const goals = toInt(req.body.goals);
    const tournaments = toInt(req.body.tournaments);
    if (games !== undefined) data.games = games;
    if (wins !== undefined) data.wins = wins;
    if (goals !== undefined) data.goals = goals;
    if (tournaments !== undefined) data.tournaments = tournaments;

    const created = await prisma.team.create({ data });
    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка создания команды:', err);
    res.status(500).json({ error: 'Ошибка создания команды' });
  }
});

// PUT /teams/:id — частичное обновление
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
      .map((l) => (typeof l === 'string' ? l : l?.src || ''))
      .filter(Boolean);

    const finalImages = [...images, ...imagesRaw]
      .map((i) => (typeof i === 'string' ? i : i?.src || ''))
      .filter(Boolean);

    const patch = {};
    if (title !== undefined) patch.title = title;
    if (city !== undefined) patch.city = city;

    // Обновляем массивы только если реально пришли новые значения (чтобы случайно не затереть)
    if (logo.length || logoRaw.length) patch.logo = finalLogo;
    if (images.length || imagesRaw.length) patch.images = finalImages;

    const games = toInt(req.body.games);
    const wins = toInt(req.body.wins);
    const goals = toInt(req.body.goals);
    const tournaments = toInt(req.body.tournaments);
    if (games !== undefined) patch.games = games;
    if (wins !== undefined) patch.wins = wins;
    if (goals !== undefined) patch.goals = goals;
    if (tournaments !== undefined) patch.tournaments = tournaments;

    const updated = await prisma.team.update({ where: { id }, data: patch });
    res.json(updated);
  } catch (err) {
    console.error('Ошибка обновления команды:', err);
    res.status(500).json({ error: 'Ошибка обновления команды' });
  }
});

// DELETE /teams/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.team.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления команды:', err);
    res.status(500).json({ error: 'Ошибка удаления команды' });
  }
});

export default router;
