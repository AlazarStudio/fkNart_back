import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 🔹 Функция перерасчета standings
async function recalcStandings(leagueId) {
  const matches = await prisma.match.findMany({
    where: { leagueId, status: 'FINISHED' },
    include: { homeTeam: true, guestTeam: true },
  });

  const table = {};

  matches.forEach((m) => {
    const homeId = m.homeTeamId;
    const guestId = m.guestTeamId;

    if (!table[homeId]) {
      table[homeId] = {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      };
    }
    if (!table[guestId]) {
      table[guestId] = {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      };
    }

    table[homeId].played++;
    table[guestId].played++;

    table[homeId].goals_for += m.homeScore;
    table[homeId].goals_against += m.guestScore;

    table[guestId].goals_for += m.guestScore;
    table[guestId].goals_against += m.homeScore;

    if (m.homeScore > m.guestScore) {
      table[homeId].wins++;
      table[homeId].points += 3;
      table[guestId].losses++;
    } else if (m.homeScore < m.guestScore) {
      table[guestId].wins++;
      table[guestId].points += 3;
      table[homeId].losses++;
    } else {
      table[homeId].draws++;
      table[guestId].draws++;
      table[homeId].points++;
      table[guestId].points++;
    }
  });

  // Удаляем старую таблицу и создаем заново
  await prisma.leagueStanding.deleteMany({ where: { league_id: leagueId } });

  const insertData = Object.keys(table).map((teamId) => ({
    league_id: leagueId,
    team_id: Number(teamId),
    ...table[teamId],
  }));

  if (insertData.length > 0) {
    await prisma.leagueStanding.createMany({ data: insertData });
  }
}

// 🔹 Все записи таблицы
router.get('/', async (req, res) => {
  try {
    const range = req.query.range ? JSON.parse(req.query.range) : [0, 50];
    const sort = req.query.sort ? JSON.parse(req.query.sort) : ['id', 'ASC'];
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const start = range[0];
    const end = range[1];
    const take = end - start + 1;

    const orderBy = {};
    orderBy[sort[0]] = sort[1].toLowerCase();

    const [data, total] = await Promise.all([
      prisma.leagueStanding.findMany({
        skip: start,
        take,
        where: filter,
        orderBy,
        include: { league: true, team: true },
      }),
      prisma.leagueStanding.count({ where: filter }),
    ]);

    res.setHeader(
      'Content-Range',
      `leagueStandings ${start}-${start + data.length - 1}/${total}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    res.json(data);
  } catch (err) {
    console.error('Ошибка GET /leagueStandings:', err);
    res.status(500).json({ error: 'Ошибка загрузки таблицы' });
  }
});

// 🔹 Получить одну запись
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const standing = await prisma.leagueStanding.findUnique({
      where: { id },
      include: { league: true, team: true },
    });
    if (!standing) return res.status(404).json({ error: 'Не найдено' });
    res.json(standing);
  } catch (err) {
    console.error('Ошибка GET /leagueStandings/:id:', err);
    res.status(500).json({ error: 'Ошибка загрузки записи' });
  }
});

// 🔹 Создать запись вручную
router.post('/', async (req, res) => {
  try {
    const {
      league_id,
      team_id,
      played,
      wins,
      draws,
      losses,
      goals_for,
      goals_against,
      points,
    } = req.body;

    const created = await prisma.leagueStanding.create({
      data: {
        league_id,
        team_id,
        played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        points,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Ошибка POST /leagueStandings:', err);
    res.status(500).json({ error: 'Ошибка создания записи' });
  }
});

// 🔹 Массовое добавление
router.post('/bulk', async (req, res) => {
  try {
    const { standings } = req.body;
    if (!Array.isArray(standings))
      return res.status(400).json({ error: 'Неверные данные' });

    await prisma.leagueStanding.createMany({ data: standings });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Ошибка POST /leagueStandings/bulk:', err);
    res.status(500).json({ error: 'Ошибка массового добавления записей' });
  }
});

// 🔹 Пересчитать таблицу для лиги
router.post('/recalc/:leagueId', async (req, res) => {
  try {
    const leagueId = Number(req.params.leagueId);

    await recalcStandings(leagueId);

    const updated = await prisma.leagueStanding.findMany({
      where: { league_id: leagueId },
      include: { league: true, team: true },
    });

    res.json({ success: true, standings: updated });
  } catch (err) {
    console.error('Ошибка пересчета standings:', err);
    res.status(500).json({ error: 'Ошибка пересчета таблицы' });
  }
});

// 🔹 Обновить запись вручную
// В PUT /:id — замените существующий обработчик на этот:
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Неверный id' });

    // берём только поля, которые разрешаем обновлять
    const allowed = [
      'league_id',
      'team_id',
      'played',
      'wins',
      'draws',
      'losses',
      'goals_for',
      'goals_against',
      'points',
    ];

    const payload = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        // если ожидаем число — приводим
        const val = req.body[key];
        // простая проверка: если ключ концетрируется на числах, приводим
        if (
          [
            'league_id',
            'team_id',
            'played',
            'wins',
            'draws',
            'losses',
            'goals_for',
            'goals_against',
            'points',
          ].includes(key)
        ) {
          // если пустая строка — игнорируем
          if (val === '' || val === null || val === undefined) continue;
          const n = Number(val);
          if (Number.isNaN(n)) {
            return res
              .status(400)
              .json({ error: `Параметр ${key} должен быть числом` });
          }
          payload[key] = n;
        } else {
          payload[key] = val;
        }
      }
    }

    // защита: не пытаемся обновлять id
    delete payload.id;

    const updated = await prisma.leagueStanding.update({
      where: { id },
      data: payload,
    });

    res.json(updated);
  } catch (err) {
    // логируем полезные детали — в dev можно вернуть клиенту, в prod — храните в логах
    console.error('Ошибка PUT /leagueStandings/:id:', err);
    // Если это PrismaKnownError — попробуйте вернуть код и meta
    const extra = {};
    if (err.code) extra.code = err.code;
    if (err.meta) extra.meta = err.meta;
    res
      .status(500)
      .json({
        error: 'Ошибка обновления записи',
        message: err.message,
        ...extra,
      });
  }
});

// 🔹 Удалить запись
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.leagueStanding.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка DELETE /leagueStandings/:id:', err);
    res.status(500).json({ error: 'Ошибка удаления записи' });
  }
});

// 🔹 Массовое удаление
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids))
      return res.status(400).json({ error: 'Неверные данные' });

    await prisma.leagueStanding.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка POST /leagueStandings/bulk-delete:', err);
    res.status(500).json({ error: 'Ошибка массового удаления записей' });
  }
});

export default router;
