export const DEFAULT_WEIGHTS = {
  preferences: 0.3,
  distance: 0.2,
  interests: 0.2,
  intention: 0.15,
  lifestyle: 0.1,
  sport: 0.05
};

export function weightsFor(me) {
  if (!me.sportMatters) return DEFAULT_WEIGHTS;
  return { ...DEFAULT_WEIGHTS, sport: 0.15, interests: 0.12, lifestyle: 0.08 };
}

export function paceScore(me, other, weights = weightsFor(me)) {
  const distance = me.radiusKm === 0 ? (other.km === 0 ? 1 : 0) : Math.max(0, 1 - other.km / me.radiusKm);
  const interests = overlap(me.hobbies, other.hobbies);
  const intention = me.intention && other.intention && me.intention === other.intention ? 1 : 0.4;
  const lifestyle = other.lifestyleFit ?? 0.5;
  const sport = sportSignal(me, other);
  const preferences = 1;
  const raw =
    preferences * weights.preferences +
    distance * weights.distance +
    interests * weights.interests +
    intention * weights.intention +
    lifestyle * weights.lifestyle +
    sport * weights.sport;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.round((raw / total) * 100);
}

function sportSignal(me, other) {
  if (!me.sport && !other.sport) return 0.5;
  if (me.sport && other.sport && me.sport === other.sport) return 1;
  if (me.sport && other.sport) return 0.45;
  return 0.35;
}

function overlap(a = [], b = []) {
  if (!a.length || !b.length) return 0.4;
  const set = new Set(b.map(v => v.toLowerCase()));
  const hits = a.filter(v => set.has(v.toLowerCase())).length;
  return hits ? Math.min(1, hits / Math.min(a.length, b.length)) : 0.2;
}

export function connectionHint(me, other) {
  const shared = (me.hobbies || []).filter(h => (other.hobbies || []).includes(h));
  if (me.sport && me.sport === other.sport && shared.length) {
    return `Vocês dois têm ${me.sport} e ${shared[0]} em comum. Pergunte sobre o último ${shared[0]}.`;
  }
  if (shared.length) return `Vocês dois gostam de ${shared[0]}.`;
  if (me.sport && me.sport === other.sport) return `Vocês dois praticam ${me.sport}. Isso é um gancho, não uma condição.`;
  return "Comece pelo que está na bio. Esporte não precisa entrar na primeira frase.";
}
