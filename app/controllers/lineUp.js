// app/controllers/lineup.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// --- helpers ---
async function getMatchTeams(tx, matchId) {
  const m = await tx.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, guestTeamId: true },
  });
  if (!m) throw new Error('Match not found');
  return m;
}

async function assertPlayersBelongToMatchTeams(tx, matchId, playerIds) {
  if (!playerIds?.length) return;
  const { homeTeamId, guestTeamId } = await getMatchTeams(tx, matchId);
  const players = await tx.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, teamId: true },
  });
  const bad = players.filter(
    (p) => p.teamId !== homeTeamId && p.teamId !== guestTeamId
  );
  if (bad.length) {
    throw new Error(
      `Игроки не относятся к командам матча: ${bad.map((b) => b.id).join(', ')}`
    );
  }
}

function normalizeRole(role) {
  const r = String(role || '').toUpperCase();
  return ['STARTER', 'SUBSTITUTE', 'RESERVE'].includes(r) ? r : 'STARTER';
}

function normInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- GET составы матча ---
router.get('/matches/:matchId/lineups', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) {
      return res.status(400).json({ error: 'Некорректный matchId' });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { homeTeamId: true, guestTeamId: true },
    });
    if (!match) return res.status(404).json({ error: 'Матч не найден' });

    const participants = await prisma.playerMatch.findMany({
      where: { matchId },
      include: { player: { include: { team: true } } },
      orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
    });

    const splitByTeam = (teamId) => {
      const list = participants.filter((p) => p.player.teamId === teamId);
      return {
        starters: list.filter((x) => x.role === 'STARTER'),
        subs: list.filter((x) => x.role === 'SUBSTITUTE'),
        reserve: list.filter((x) => x.role === 'RESERVE'),
      };
    };

    res.json({
      homeTeamId: match.homeTeamId,
      guestTeamId: match.guestTeamId,
      home: splitByTeam(match.homeTeamId),
      guest: splitByTeam(match.guestTeamId),
    });
  } catch (err) {
    console.error('Ошибка GET /matches/:matchId/lineups:', err);
    res.status(500).json({ error: 'Ошибка получения составов' });
  }
});

// --- PUT полная замена составов матча ---
router.put('/matches/:matchId/lineups', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) {
      return res.status(400).json({ error: 'Некорректный matchId' });
    }
    const { home = {}, guest = {}, orders = {} } = req.body;

    const collectIds = (o) =>
      [...(o.starters || []), ...(o.subs || []), ...(o.reserve || [])]
        .map(Number)
        .filter(Number.isFinite);

    await prisma.$transaction(async (tx) => {
      await assertPlayersBelongToMatchTeams(tx, matchId, [
        ...collectIds(home),
        ...collectIds(guest),
      ]);

      await tx.playerMatch.deleteMany({ where: { matchId } });

      const makeRows = (arr, role, teamOrders, positions, captainId) =>
        arr.map((pid, idx) => ({
          playerId: Number(pid),
          matchId,
          role,
          isCaptain: Number(pid) === Number(captainId),
          position: positions?.[pid] ?? null,
          order:
            normInt(teamOrders?.[pid]) ??
            (role === 'STARTER'
              ? idx + 1
              : role === 'SUBSTITUTE'
                ? 100 + idx + 1
                : 200 + idx + 1),
        }));

      const homeRows = [
        ...makeRows(
          home.starters || [],
          'STARTER',
          orders?.home,
          home.positions,
          home.captainId
        ),
        ...makeRows(
          home.subs || [],
          'SUBSTITUTE',
          orders?.home,
          home.positions,
          home.captainId
        ),
        ...makeRows(
          home.reserve || [],
          'RESERVE',
          orders?.home,
          home.positions,
          home.captainId
        ),
      ];

      const guestRows = [
        ...makeRows(
          guest.starters || [],
          'STARTER',
          orders?.guest,
          guest.positions,
          guest.captainId
        ),
        ...makeRows(
          guest.subs || [],
          'SUBSTITUTE',
          orders?.guest,
          guest.positions,
          guest.captainId
        ),
        ...makeRows(
          guest.reserve || [],
          'RESERVE',
          orders?.guest,
          guest.positions,
          guest.captainId
        ),
      ];

      const data = [...homeRows, ...guestRows];
      if (data.length) {
        await tx.playerMatch.createMany({ data, skipDuplicates: true });
      }
    });

    const result = await prisma.playerMatch.findMany({
      where: { matchId },
      include: { player: { include: { team: true } } },
      orderBy: [{ role: 'asc' }, { order: 'asc' }, { id: 'asc' }],
    });
    res.json(result);
  } catch (err) {
    console.error('Ошибка PUT /matches/:matchId/lineups:', err);
    res.status(500).json({ error: 'Ошибка сохранения составов' });
  }
});

// --- PATCH добавить игрока в заявку ---
router.patch('/matches/:matchId/lineups/add', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const { playerId, role, position, isCaptain, order } = req.body;
    const pid = Number(playerId);
    if (!Number.isFinite(matchId) || !Number.isFinite(pid)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }

    await prisma.$transaction(async (tx) => {
      await assertPlayersBelongToMatchTeams(tx, matchId, [pid]);
      await tx.playerMatch.upsert({
        where: { playerId_matchId: { playerId: pid, matchId } },
        update: {
          role: normalizeRole(role),
          position: position ?? undefined,
          isCaptain: typeof isCaptain === 'boolean' ? isCaptain : undefined,
          order: normInt(order) ?? undefined,
        },
        create: {
          playerId: pid,
          matchId,
          role: normalizeRole(role),
          position: position ?? null,
          isCaptain: Boolean(isCaptain),
          order: normInt(order) ?? 0,
        },
      });
    });

    const row = await prisma.playerMatch.findUnique({
      where: { playerId_matchId: { playerId: pid, matchId } },
      include: { player: { include: { team: true } } },
    });
    res.json(row);
  } catch (err) {
    console.error('Ошибка PATCH /matches/:matchId/lineups/add:', err);
    res.status(500).json({ error: 'Ошибка добавления игрока в состав' });
  }
});

// --- PATCH удалить игрока из заявки ---
router.patch('/matches/:matchId/lineups/remove', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const pid = Number(req.body.playerId);
    if (!Number.isFinite(matchId) || !Number.isFinite(pid)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }
    await prisma.playerMatch.delete({
      where: { playerId_matchId: { playerId: pid, matchId } },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка PATCH /matches/:matchId/lineups/remove:', err);
    res.status(500).json({ error: 'Ошибка удаления игрока из состава' });
  }
});

// --- PATCH обновить капитана ---
router.patch('/matches/:matchId/lineups/captain', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const pid = Number(req.body.playerId);
    if (!Number.isFinite(matchId) || !Number.isFinite(pid)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }

    await prisma.$transaction(async (tx) => {
      await assertPlayersBelongToMatchTeams(tx, matchId, [pid]);
      await tx.playerMatch.updateMany({
        where: { matchId },
        data: { isCaptain: false },
      });
      await tx.playerMatch.update({
        where: { playerId_matchId: { playerId: pid, matchId } },
        data: { isCaptain: true },
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка PATCH /matches/:matchId/lineups/captain:', err);
    res.status(500).json({ error: 'Ошибка установки капитана' });
  }
});

// --- PATCH позиция/порядок ---
router.patch('/matches/:matchId/lineups/meta', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const pid = Number(req.body.playerId);
    const { position, order } = req.body;
    if (!Number.isFinite(matchId) || !Number.isFinite(pid)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }
    const row = await prisma.playerMatch.update({
      where: { playerId_matchId: { playerId: pid, matchId } },
      data: {
        position: position ?? undefined,
        order: normInt(order) ?? undefined,
      },
      include: { player: true },
    });
    res.json(row);
  } catch (err) {
    console.error('Ошибка PATCH /matches/:matchId/lineups/meta:', err);
    res.status(500).json({ error: 'Ошибка обновления данных состава' });
  }
});

// --- PATCH отметить замену (минуты) ---
router.patch('/matches/:matchId/lineups/substitution', async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const playerOutId = req.body.playerOutId
      ? Number(req.body.playerOutId)
      : null;
    const playerInId = req.body.playerInId ? Number(req.body.playerInId) : null;
    const minute = Number(req.body.minute);
    const half = req.body.half ? Number(req.body.half) : 2;

    if (!Number.isFinite(matchId) || !Number.isFinite(minute)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }

    await prisma.$transaction(async (tx) => {
      if (playerOutId) {
        await tx.playerMatch.update({
          where: { playerId_matchId: { playerId: playerOutId, matchId } },
          data: { minutesOut: minute },
        });
      }
      if (playerInId) {
        await tx.playerMatch.upsert({
          where: { playerId_matchId: { playerId: playerInId, matchId } },
          update: { minutesIn: minute, role: 'SUBSTITUTE' },
          create: {
            playerId: playerInId,
            matchId,
            minutesIn: minute,
            role: 'SUBSTITUTE',
          },
        });
      }

      // опционально: создадим событие SUBSTITUTION
      if (playerInId || playerOutId) {
        const pid = playerInId ?? playerOutId;
        const pl = await tx.player.findUnique({
          where: { id: pid },
          select: { teamId: true },
        });
        const teamId = pl?.teamId ?? null;
        if (teamId) {
          await tx.matchEvent.create({
            data: {
              minute,
              half,
              type: 'SUBSTITUTION',
              playerId: pid,
              teamId,
              matchId,
              description:
                playerInId && playerOutId
                  ? `Замена: ${playerOutId} → ${playerInId}`
                  : playerInId
                    ? `Вышел: ${playerInId}`
                    : `Ушёл: ${playerOutId}`,
            },
          });
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка PATCH /matches/:matchId/lineups/substitution:', err);
    res.status(500).json({ error: 'Ошибка фиксации замены' });
  }
});

export default router;
