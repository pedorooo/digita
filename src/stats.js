// Estatísticas que duram enquanto a sala existir: vitórias, sequências, recordes, histórico.
import { normalize } from './words.js';

function createStats() {
  return {
    round: 0,
    players: new Map(), // chave = nome normalizado → estatísticas do jogador
    records: {
      bestScore: null, // mais pontos numa rodada
      fastest: null, // palavra respondida mais rápido
      bestCombo: null, // mais acertos seguidos sem pular
      bestWinStreak: null, // mais vitórias seguidas
    },
    lastWinner: null,
    history: [], // últimas rodadas
  };
}

const keyOf = (name) => normalize(name);

function playerStats(stats, name, avatar) {
  const key = keyOf(name);
  let s = stats.players.get(key);
  if (!s) {
    s = {
      name,
      avatar,
      rounds: 0,
      wins: 0,
      totalWords: 0,
      totalPoints: 0,
      bestScore: 0,
      winStreak: 0,
      bestWinStreak: 0,
      bestCombo: 0,
      fastestMs: null,
    };
    stats.players.set(key, s);
  }
  s.name = name;
  s.avatar = avatar;
  return s;
}

/**
 * Aplica o resultado de uma rodada.
 * @param ranking  jogadores ordenados: { id, name, avatar, score, wrong, skipped, bestCombo, fastestMs, fastestWord }
 * @returns resumo da rodada (vencedor, prêmios, novos recordes, recordes pessoais por id)
 */
function applyRound(stats, ranking, duration) {
  stats.round++;
  const round = stats.round;
  const who = (p) => ({ name: p.name, avatar: p.avatar });
  const winner = ranking[0] && ranking[0].score > 0 ? ranking[0] : null;
  const newRecords = [];
  const personal = {}; // id → { newBest, prevBest, winStreak, wins }

  for (const p of ranking) {
    const s = playerStats(stats, p.name, p.avatar);
    const prevBest = s.bestScore;
    s.rounds++;
    s.totalWords += p.words || 0;
    s.totalPoints = Math.round((s.totalPoints + p.score) * 100) / 100;
    if (p.score > s.bestScore) s.bestScore = p.score;
    if (p.bestCombo > s.bestCombo) s.bestCombo = p.bestCombo;
    if (p.fastestMs != null && (s.fastestMs == null || p.fastestMs < s.fastestMs)) s.fastestMs = p.fastestMs;
    if (winner && p.id === winner.id) {
      s.wins++;
      s.winStreak++;
      s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
    } else {
      s.winStreak = 0;
    }
    personal[p.id] = {
      newBest: p.score > 0 && p.score > prevBest && s.rounds > 1,
      prevBest,
      wins: s.wins,
      winStreak: s.winStreak,
      rounds: s.rounds,
      bestScore: s.bestScore,
    };
  }

  const r = stats.records;
  // mais pontos numa rodada
  const top = ranking[0];
  if (top && top.score > 0 && (!r.bestScore || top.score > r.bestScore.value)) {
    r.bestScore = { ...who(top), value: top.score, duration, round };
    newRecords.push({ kind: 'bestScore', ...r.bestScore });
  }
  // palavra mais rápida
  const fast = ranking.filter((p) => p.fastestMs != null).sort((a, b) => a.fastestMs - b.fastestMs)[0];
  if (fast && (!r.fastest || fast.fastestMs < r.fastest.ms)) {
    r.fastest = { ...who(fast), ms: fast.fastestMs, word: fast.fastestWord, round };
    newRecords.push({ kind: 'fastest', ...r.fastest });
  }
  // maior combo
  const combo = [...ranking].sort((a, b) => b.bestCombo - a.bestCombo)[0];
  if (combo && combo.bestCombo >= 2 && (!r.bestCombo || combo.bestCombo > r.bestCombo.value)) {
    r.bestCombo = { ...who(combo), value: combo.bestCombo, round };
    newRecords.push({ kind: 'bestCombo', ...r.bestCombo });
  }
  // maior sequência de vitórias
  if (winner) {
    const ws = stats.players.get(keyOf(winner.name)).winStreak;
    if (ws >= 2 && (!r.bestWinStreak || ws > r.bestWinStreak.value)) {
      r.bestWinStreak = { ...who(winner), value: ws, round };
      newRecords.push({ kind: 'bestWinStreak', ...r.bestWinStreak });
    }
  }

  // prêmios da rodada
  const awards = [];
  if (fast) awards.push({ kind: 'fastest', ...who(fast), ms: fast.fastestMs, word: fast.fastestWord });
  if (combo && combo.bestCombo >= 2) awards.push({ kind: 'combo', ...who(combo), value: combo.bestCombo });
  const accurate = ranking
    .filter((p) => p.words >= 3)
    .map((p) => ({ p, acc: p.words / (p.words + p.wrong + p.skipped) }))
    .sort((a, b) => b.acc - a.acc || b.p.score - a.p.score)[0];
  if (accurate) awards.push({ kind: 'accuracy', ...who(accurate.p), value: Math.round(accurate.acc * 100) });
  const skipper = [...ranking].sort((a, b) => b.skipped - a.skipped)[0];
  if (skipper && skipper.skipped >= 3) awards.push({ kind: 'skipper', ...who(skipper), value: skipper.skipped });
  if (winner) {
    const ws = stats.players.get(keyOf(winner.name)).winStreak;
    if (ws >= 2) awards.push({ kind: 'streak', ...who(winner), value: ws });
  }

  const prevWinner = stats.lastWinner;
  if (winner) stats.lastWinner = { ...who(winner), score: winner.score, words: winner.words, round };
  stats.history.unshift({ round, duration, winner: winner ? { ...who(winner), score: winner.score } : null, players: ranking.length });
  stats.history = stats.history.slice(0, 10);

  return { round, winner: winner ? who(winner) : null, prevWinner, awards, newRecords, personal };
}

function publicStats(stats) {
  return {
    round: stats.round,
    records: stats.records,
    lastWinner: stats.lastWinner,
    history: stats.history,
    players: [...stats.players.values()]
      .filter((s) => s.rounds > 0)
      .sort((a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints),
  };
}

function statsFor(stats, name) {
  return stats.players.get(keyOf(name)) || null;
}

export { createStats, applyRound, publicStats, statsFor, playerStats };
