/**
 * Builds pokemon-library.json — the app's own data file.
 *
 * Data source: PokéAPI (https://pokeapi.co), which is free to use and asks
 * only that callers cache locally rather than hammer the API — which is
 * exactly what this script exists to do. Credit it in anything you ship.
 *
 * Run once (and again when a new game ships):
 *     node build-library.mjs
 *
 * Commit the JSON afterwards. The app imports it and never touches the
 * network again, so it works offline and can't break because someone
 * else's API had a bad day.
 *
 * Needs Node 18 or newer. Takes a few minutes — PokéAPI asks callers to
 * be gentle, so this runs 8 requests at a time rather than 1,300 at once.
 *
 * Output shape:
 *   { games: [{ id, label, group, order }], pokemon: [{ ... , groups, since }] }
 */

import { writeFile } from "node:fs/promises";

const API = "https://pokeapi.co/api/v2";
const OUT = "src/pokemon-library.json";
const CONCURRENCY = 8;

/* The only abilities the app models. Keep identical to ABILITY in the app. */
const RELEVANT = new Set([
  "levitate", "flash-fire", "water-absorb", "storm-drain", "volt-absorb",
  "lightning-rod", "motor-drive", "sap-sipper", "dry-skin", "thick-fat",
  "heatproof", "water-bubble", "fluffy", "solid-rock", "filter",
  "prism-armor", "wonder-guard", "mold-breaker", "teravolt", "turboblaze",
  "scrappy", "tinted-lens",
]);

/* Species whose alternate forms differ only cosmetically — keeping them all
   would bury Alolan Vulpix under fifteen Pikachu hats. */
const COSMETIC_ONLY = new Set(["pikachu", "minior", "unown", "vivillon", "furfrou", "alcremie"]);

/* Regional and battle forms can't appear in a game older than the one that
   introduced them. Dex data is species-level and so can't express this on
   its own — this table is what stops Galarian Ponyta showing up in Emerald. */
const FORM_DEBUT = {
  mega: "x-y", primal: "omega-ruby-alpha-sapphire",
  alola: "sun-moon", totem: "sun-moon", "totem-alola": "sun-moon",
  galar: "sword-shield", gmax: "sword-shield",
  hisui: "legends-arceus",
  paldea: "scarlet-violet",
};

const titleCase = (s) =>
  s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function label(slug, species) {
  if (slug === species) return titleCase(species);
  const suffix = slug.startsWith(`${species}-`) ? slug.slice(species.length + 1) : slug;
  const base = titleCase(species);
  const known = {
    alola: `Alolan ${base}`, galar: `Galarian ${base}`,
    hisui: `Hisuian ${base}`, paldea: `Paldean ${base}`,
    totem: `Totem ${base}`, "totem-alola": `Totem Alolan ${base}`,
    mega: `Mega ${base}`, gmax: `Gigantamax ${base}`,
  };
  return known[suffix] ?? `${base} (${titleCase(suffix)})`;
}

const suffixOf = (slug, species) =>
  slug.startsWith(`${species}-`) ? slug.slice(species.length + 1) : null;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await worker(items[i]); }
      catch (err) { out[i] = null; console.warn(`  skipped: ${err.message}`); }
      if (++done % 100 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
  return out.filter(Boolean);
}

/* ---- 1. Games ---------------------------------------------------------- */
console.log("Fetching version groups…");
const vgIndex = await get(`${API}/version-group?limit=100`);
const vgs = await pool(vgIndex.results, CONCURRENCY, ({ url }) => get(url));

const groupOrder = new Map(vgs.map((g) => [g.name, g.order]));

/* One row per playable game, not per version group, because you play
   Ultra Sun — you don't play "ultra-sun-ultra-moon". */
const games = vgs.flatMap((g) =>
  g.versions.map((v) => ({
    id: v.name,
    label: titleCase(v.name),
    group: g.name,
    order: g.order,
  }))
).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

console.log(`${games.length} games.`);

/* ---- 2. Which species appear in which games ---------------------------- */
console.log("Fetching regional dexes…");
const dexIndex = await get(`${API}/pokedex?limit=100`);
const dexes = await pool(
  dexIndex.results.filter((d) => d.name !== "national"),
  CONCURRENCY,
  ({ url }) => get(url)
);

/* species name -> Set of version-group names */
const speciesGroups = new Map();
for (const dex of dexes) {
  if (!dex.is_main_series) continue;
  const groups = dex.version_groups.map((g) => g.name);
  if (!groups.length) continue;
  for (const entry of dex.pokemon_entries) {
    const name = entry.pokemon_species.name;
    if (!speciesGroups.has(name)) speciesGroups.set(name, new Set());
    for (const g of groups) speciesGroups.get(name).add(g);
  }
}
console.log(`${speciesGroups.size} species mapped to games.`);

/* ---- 3. Every Pokémon and form ---------------------------------------- */
console.log("Fetching Pokémon…");
const index = await get(`${API}/pokemon?limit=20000`);

const pokemon = await pool(index.results, CONCURRENCY, async ({ url }) => {
  const p = await get(url);
  const species = p.species?.name ?? p.name;
  if (COSMETIC_ONLY.has(species) && p.name !== species) return null;

  const debut = FORM_DEBUT[suffixOf(p.name, species)];
  return {
    id: p.id,
    name: p.name,
    label: label(p.name, species),
    types: p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    speed: p.stats.find((s) => s.stat.name === "speed")?.base_stat ?? null,
    abilities: p.abilities.map((a) => a.ability.name).filter((a) => RELEVANT.has(a)),
    groups: [...(speciesGroups.get(species) ?? [])],
    /* Earliest version-group order this form can appear in. 0 = always. */
    since: debut ? (groupOrder.get(debut) ?? 0) : 0,
  };
});

pokemon.sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));

await writeFile(OUT, JSON.stringify({ games, pokemon }), "utf8");

const size = (JSON.stringify({ games, pokemon }).length / 1024).toFixed(0);
const unscoped = pokemon.filter((p) => !p.groups.length).length;
console.log(`\nWrote ${OUT}`);
console.log(`  ${pokemon.length} Pokémon and forms across ${games.length} games`);
console.log(`  ${pokemon.length - unscoped} scoped to at least one game`);
console.log(`  ${size} KB`);
