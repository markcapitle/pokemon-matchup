/**
 * Type chart, ability table, and the logic that turns them into a matchup.
 *
 * This module is deliberately pure — no React, no DOM, no imports. Every
 * answer the app gives traces back to the two tables below, so this is the
 * part worth testing. See typechart.test.js.
 *
 * Chart is Gen 6 onward, which is current.
 */

export const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

/* CHART[attacker][defender] = multiplier. Omitted means 1x. */
export const CHART = {
  normal:   { rock: .5, ghost: 0, steel: .5 },
  fire:     { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water:    { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass:    { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice:      { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison:   { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying:   { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic:  { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug:      { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock:     { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon:   { dragon: 2, steel: .5, fairy: 0 },
  dark:     { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel:    { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy:    { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
};

/**
 * Only abilities that move a multiplier. Everything else an ability does —
 * stat changes, weather, status — is out of scope, and anything absent here
 * resolves to no change rather than a guess.
 *
 * Keep in step with RELEVANT in build-library.mjs, or the library will offer
 * abilities the app can't act on.
 *
 *   immune       list of attacking types this defender takes nothing from
 *   mult         per-type multiplier applied to incoming damage
 *   dampen       reduce super effective hits to three quarters
 *   wonderGuard  nothing lands unless it is super effective
 *   ignores      attacker side: skip the defender's ability entirely
 *   scrappy      attacker side: Normal and Fighting reach Ghost
 *   tinted       attacker side: resisted hits count double
 */
export const ABILITY = {
  levitate:        { immune: ["ground"],   note: "Ground can't touch it" },
  "flash-fire":    { immune: ["fire"],     note: "absorbs Fire" },
  "water-absorb":  { immune: ["water"],    note: "absorbs Water" },
  "storm-drain":   { immune: ["water"],    note: "absorbs Water" },
  "volt-absorb":   { immune: ["electric"], note: "absorbs Electric" },
  "lightning-rod": { immune: ["electric"], note: "absorbs Electric" },
  "motor-drive":   { immune: ["electric"], note: "absorbs Electric" },
  "sap-sipper":    { immune: ["grass"],    note: "absorbs Grass" },
  "dry-skin":      { immune: ["water"], mult: { fire: 1.25 }, note: "absorbs Water, burns easier" },
  "thick-fat":     { mult: { fire: .5, ice: .5 }, note: "halves Fire and Ice" },
  heatproof:       { mult: { fire: .5 },   note: "halves Fire" },
  "water-bubble":  { mult: { fire: .5 },   note: "halves Fire" },
  fluffy:          { mult: { fire: 2 },    note: "doubles Fire damage taken" },
  "solid-rock":    { dampen: true,         note: "softens super effective hits" },
  filter:          { dampen: true,         note: "softens super effective hits" },
  "prism-armor":   { dampen: true,         note: "softens super effective hits" },
  "wonder-guard":  { wonderGuard: true,    note: "only super effective moves land" },
  "mold-breaker":  { ignores: true,  note: "ignores their ability" },
  teravolt:        { ignores: true,  note: "ignores their ability" },
  turboblaze:      { ignores: true,  note: "ignores their ability" },
  scrappy:         { scrappy: true,  note: "Normal and Fighting hit Ghost" },
  "tinted-lens":   { tinted: true,   note: "resisted hits count double" },
};

/**
 * Multiplier of attacking type `atk` into a defender, with both sides'
 * abilities applied. Pass null for either ability to get the raw chart answer.
 *
 * Order matters and is not arbitrary:
 *   1. multiply the chart across every defending type
 *   2. Scrappy rescues the Ghost immunity while doing so, not after
 *   3. defender immunities short circuit
 *   4. flat multipliers, then dampening (which only touches 2x and above)
 *   5. Wonder Guard last on the defender side, so it sees the final number
 *   6. Tinted Lens last overall, and never revives a zero
 */
export function resolve(atk, defTypes, defAbility, atkAbility) {
  const A = ABILITY[atkAbility] || {};
  const D = A.ignores ? {} : (ABILITY[defAbility] || {});

  let m = 1;
  for (const d of defTypes) {
    let x = CHART[atk]?.[d] ?? 1;
    if (x === 0 && A.scrappy && d === "ghost" && (atk === "normal" || atk === "fighting")) x = 1;
    m *= x;
  }

  if (D.immune?.includes(atk)) return 0;
  if (D.mult?.[atk]) m *= D.mult[atk];
  if (D.dampen && m > 1) m *= 0.75;
  if (D.wonderGuard && m <= 1) return 0;
  if (A.tinted && m > 0 && m < 1) m *= 2;
  return m;
}

/**
 * Two multipliers plus speed, turned into a single call.
 * `faster` is null when either side has no speed entered.
 */
export function verdict({ deal, take, faster }) {
  if (take === 0) return { label: "Free switch-in", tone: "good" };
  if (deal >= 2 && take <= 0.5) return { label: "Lead with this", tone: "good" };
  if (deal >= 2 && take <= 1) return { label: "Good matchup", tone: "good" };
  if (deal >= 2 && take >= 2) {
    if (faster === true) return { label: "Race — you're faster", tone: "warn" };
    if (faster === false) return { label: "Race — they're faster", tone: "bad" };
    return { label: "Race — add speeds to call it", tone: "warn" };
  }
  if (take >= 2) return { label: "Keep out", tone: "bad" };
  if (deal <= 0.5) return { label: "Can't break it", tone: "bad" };
  return { label: "Even", tone: "flat" };
}
