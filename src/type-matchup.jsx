import React, { useState, useEffect, useMemo } from "react";
import LIBRARY from "./pokemon-library.json";
/* ---------------------------------------------------------------
   Offline type matchup advisor. No network calls anywhere: you
   enter types by hand, and every number below comes from the two
   tables in this file. Nothing to load, nothing to fail.
----------------------------------------------------------------*/

const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

/* Current type chart (Gen 6 onward, still current today).
   CHART[attacker][defender] = multiplier. Omitted means 1x. */
const CHART = {
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

/* Only abilities that move a multiplier. Everything else an ability
   does is out of scope, so anything absent here changes nothing. */
const ABILITY = {
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

const ABILITY_NAMES = Object.keys(ABILITY).sort();

const TYPE_COLOR = {
  normal: "#9FA19F", fire: "#E8503A", water: "#4A8FE0", electric: "#F2C33A",
  grass: "#5FBA5A", ice: "#6FD3D8", fighting: "#C0442B", poison: "#9A4FA0",
  ground: "#C9A03C", flying: "#8CA9E8", psychic: "#EC5F8E", bug: "#96B33C",
  rock: "#B0A25C", ghost: "#6E5B9E", dragon: "#5F52C7", dark: "#5A4A45",
  steel: "#8E9BA8", fairy: "#E88FCB",
};

/* The library built by build-library.mjs. In your repo, replace this line
   with:  import LIBRARY from "./pokemon-library.json";
   Without it the app still works — you just enter types by hand. */

const GAMES = LIBRARY?.games ?? [];
const POKEMON = LIBRARY?.pokemon ?? [];
const HAS_LIBRARY = POKEMON.length > 0;

/* Search, optionally scoped to one game. A Pokémon is in a game when the
   species appears in that game's dex and the form existed by then. */
function lookup(text, gameId) {
  const q = text.trim().toLowerCase();
  if (!q || !HAS_LIBRARY) return [];
  const game = GAMES.find((g) => g.id === gameId);
  return POKEMON
    .filter((e) => {
      if (game && !(e.groups.includes(game.group) && e.since <= game.order)) return false;
      return e.label.toLowerCase().includes(q) || e.name.includes(q);
    })
    .sort((a, b) => a.label.toLowerCase().indexOf(q) - b.label.toLowerCase().indexOf(q)
                 || a.label.length - b.label.length)
    .slice(0, 6);
}

const MAX_TEAM = 6;
const STORE_KEY = "pokemon-matchup";

/* Saves to whatever the host offers. In a normal browser that's
   localStorage; some sandboxes provide window.storage instead; if neither
   works the app runs fine and just forgets between sessions. */
const store = {
  async get(key) {
    if (typeof window === "undefined") return null;
    if (window.storage) return window.storage.get(key);
    const v = window.localStorage?.getItem(key);
    return v == null ? null : { value: v };
  },
  async set(key, value) {
    if (typeof window === "undefined") return;
    if (window.storage) return window.storage.set(key, value);
    window.localStorage?.setItem(key, value);
  },
};

function titleCase(s) {
  return s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const MULT = { 0.25: "¼×", 0.5: "½×", 0.75: "¾×", 1.5: "1½×" };
const fmt = (n) => (n === 0 ? "immune" : MULT[n] ?? `${+n.toFixed(2)}×`);

/* Multiplier of attacking type `atk` into a defender, with both sides'
   abilities applied. Pass null for either to get the raw chart answer. */
function resolve(chart, atk, defTypes, defAbility, atkAbility) {
  const A = ABILITY[atkAbility] || {};
  const D = A.ignores ? {} : (ABILITY[defAbility] || {});

  let m = 1;
  for (const d of defTypes) {
    let x = chart[atk]?.[d] ?? 1;
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

/* Two multipliers plus speed, turned into a single call. `faster` is
   null when either side has no speed entered. */
function verdict({ deal, take, faster }) {
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

let seq = 0;
const blank = () => ({ id: ++seq, label: "", t1: "", t2: "", ability: "", speed: "" });
const typesOf = (m) => [m.t1, m.t2].filter(Boolean);
const named = (m, fallback) => m.label.trim() || fallback;

/* One editable row. Used for party members and the opponent alike. */
function MonRow({ mon, onChange, onRemove, placeholder, types, game }) {
  const set = (k) => (e) => onChange({ ...mon, [k]: e.target.value });
  const [open, setOpen] = useState(false);
  const hits = open ? lookup(mon.label, game) : [];

  /* Picking from the library fills the row in; every field stays editable
     afterwards, so a wrong ability or an odd build is still yours to fix. */
  function choose(entry) {
    onChange({
      ...mon,
      label: entry.label,
      t1: entry.types[0] ?? "",
      t2: entry.types[1] ?? "",
      ability: entry.abilities.includes(mon.ability) ? mon.ability : (entry.abilities[0] ?? ""),
      speed: entry.speed == null ? "" : String(entry.speed),
    });
    setOpen(false);
  }

  return (
    <div className="us-row">
      <div className="us-row-line">
        <input
          className="us-text"
          value={mon.label}
          onChange={(e) => { set("label")(e); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={HAS_LIBRARY ? "Search a Pokémon…" : placeholder}
          aria-label={HAS_LIBRARY ? "Search a Pokémon" : "Name (optional)"}
        />
        {onRemove && (
          <button className="us-remove" onClick={onRemove} aria-label="Remove">×</button>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="us-suggest">
          {hits.map((e) => (
            <li key={e.name}>
              <button onClick={() => choose(e)}>
                {e.label}
                <span className="us-suggest-t">{e.types.join(" / ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="us-row-line">
        <select
          className="us-sel type"
          value={mon.t1}
          onChange={set("t1")}
          style={{ color: TYPE_COLOR[mon.t1] || undefined }}
          aria-label="First type"
        >
          <option value="">Type…</option>
          {types.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
        <select
          className="us-sel type"
          value={mon.t2}
          onChange={set("t2")}
          style={{ color: TYPE_COLOR[mon.t2] || undefined }}
          aria-label="Second type"
        >
          <option value="">— none —</option>
          {types.filter((t) => t !== mon.t1).map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
      </div>
      <div className="us-row-line">
        <select
          className={`us-sel ${ABILITY[mon.ability] ? "live" : ""}`}
          value={mon.ability}
          onChange={set("ability")}
          aria-label="Ability"
        >
          <option value="">No relevant ability</option>
          {ABILITY_NAMES.map((a) => (
            <option key={a} value={a}>{titleCase(a)}</option>
          ))}

        </select>
        <input
          className="us-text speed"
          value={mon.speed}
          onChange={set("speed")}
          inputMode="numeric"
          placeholder="Speed"
          aria-label="Speed stat (optional)"
        />
      </div>
    </div>
  );
}

export default function TypeMatchup() {
  const [team, setTeam] = useState([blank()]);
  const [opp, setOpp] = useState(blank());
  const [game, setGame] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saves, setSaves] = useState(false);

  /* Persistence is best effort. If the host doesn't provide storage the
     app still works fully — it just forgets between sessions. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await store.get(STORE_KEY);
        const saved = res ? JSON.parse(res.value) : null;
        if (!cancelled && Array.isArray(saved?.team) && saved.team.length) {
          setTeam(saved.team);
          if (saved.opp) setOpp(saved.opp);
          if (typeof saved.game === "string") setGame(saved.game);
          seq = Math.max(seq, ...saved.team.map((m) => m.id || 0));
        }
        if (!cancelled) setSaves(true);
      } catch {
        if (!cancelled) setSaves(true);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try { await store.set(STORE_KEY, JSON.stringify({ team, opp, game })); }
      catch { setSaves(false); }
    })();
  }, [team, opp, game, hydrated]);

  const update = (next) => setTeam((t) => t.map((m) => (m.id === next.id ? next : m)));
  const addSlot = () => setTeam((t) => (t.length >= MAX_TEAM ? t : [...t, blank()]));
  const removeSlot = (id) =>
    setTeam((t) => (t.length === 1 ? [blank()] : t.filter((m) => m.id !== id)));

  const chart = CHART;
  const oppTypes = typesOf(opp);
  const ready = oppTypes.length > 0;

  const matchups = useMemo(() => {
    if (!ready) return [];
    const oAb = opp.ability || null;
    const oSpeed = opp.speed === "" ? null : Number(opp.speed);

    return team.filter((m) => m.t1).map((m, i) => {
      const mine = typesOf(m);
      const ab = m.ability || null;
      const deal = Math.max(...mine.map((t) => resolve(chart, t, oppTypes, oAb, ab)));
      const take = Math.max(...oppTypes.map((t) => resolve(chart, t, mine, ab, oAb)));
      const dealBy = mine.filter((t) => resolve(chart, t, oppTypes, oAb, ab) === deal);
      const takeBy = oppTypes.filter((t) => resolve(chart, t, mine, ab, oAb) === take);

      const rawDeal = Math.max(...mine.map((t) => resolve(chart, t, oppTypes, null, null)));
      const rawTake = Math.max(...oppTypes.map((t) => resolve(chart, t, mine, null, null)));
      const swung = deal !== rawDeal || take !== rawTake;
      const cause = [
        ABILITY[ab] && `Your ${titleCase(ab)} — ${ABILITY[ab].note}`,
        ABILITY[oAb] && `Their ${titleCase(oAb)} — ${ABILITY[oAb].note}`,
      ].filter(Boolean);

      const mySpeed = m.speed === "" ? null : Number(m.speed);
      const faster =
        mySpeed === null || oSpeed === null || Number.isNaN(mySpeed) || Number.isNaN(oSpeed)
          ? null
          : mySpeed > oSpeed;

      return {
        ...m, mine, deal, take, dealBy, takeBy, faster, swung, cause,
        display: named(m, `Slot ${i + 1}`),
        score: deal / Math.max(take, 0.2),
      };
    }).sort((a, b) => b.score - a.score);
  }, [team, opp, ready]);

  const best = matchups[0];

  return (
    <div className="us-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap');

        .us-root {
          --dusk: #150E2E;
          --dusk-2: #221646;
          --dusk-3: #2E2059;
          --rotom: #FF6B2C;
          --solgaleo: #FFC43D;
          --plasma: #46E5C8;
          --haze: #B9AEE0;
          --paper: #F3EEFF;

          background: radial-gradient(120% 90% at 50% -10%, #3A2170 0%, var(--dusk) 55%);
          color: var(--paper);
          font-family: 'DM Sans', system-ui, sans-serif;
          min-height: 100%;
          padding: 20px 16px 48px;
          box-sizing: border-box;
        }
        .us-root *, .us-root *::before, .us-root *::after { box-sizing: border-box; }

        .us-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
          color: var(--solgaleo); margin: 0 0 6px;
        }
        .us-title {
          font-family: 'Baloo 2', system-ui, sans-serif; font-weight: 800;
          font-size: 34px; line-height: 1.05; margin: 0 0 4px; letter-spacing: -.01em;
        }
        .us-sub { color: var(--haze); font-size: 13px; margin: 0 0 22px; line-height: 1.45; }

        .us-panel {
          background: var(--dusk-2);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 18px; padding: 16px; margin-bottom: 16px;
        }
        .us-panel.opp { border-color: rgba(255,107,44,.45); }
        .us-h2 { font-family: 'Baloo 2', sans-serif; font-weight: 600; font-size: 17px; margin: 0 0 2px; }
        .us-note { color: var(--haze); font-size: 12px; margin: 0 0 14px; line-height: 1.45; }

        .us-row {
          background: var(--dusk-3);
          border-radius: 14px; padding: 10px; margin-bottom: 10px;
          display: flex; flex-direction: column; gap: 7px;
        }
        .us-row-line { display: flex; gap: 7px; align-items: center; }

        .us-text, .us-sel {
          background: var(--dusk);
          border: 1.5px solid rgba(255,255,255,.12);
          border-radius: 10px;
          color: var(--paper);
          font-family: inherit; font-size: 14px;
          padding: 9px 11px; width: 100%; min-width: 0;
          outline: none;
        }
        .us-text::placeholder { color: #6E619B; }
        .us-text:focus, .us-sel:focus { border-color: var(--plasma); }
        .us-text.speed { max-width: 96px; font-family: 'DM Mono', monospace; font-size: 12.5px; }
        .us-sel { appearance: none; cursor: pointer; font-size: 13px; }
        .us-sel.type { font-weight: 700; }
        .us-sel.live { color: var(--solgaleo); border-color: rgba(255,196,61,.5); }
        .us-sel option { background: var(--dusk-2); color: var(--paper); }

        .us-remove {
          background: none; border: 1px solid rgba(255,255,255,.14);
          border-radius: 8px; color: var(--haze); cursor: pointer;
          font-size: 16px; line-height: 1; padding: 7px 10px; flex: none;
        }
        .us-remove:hover { color: var(--rotom); border-color: var(--rotom); }

        .us-add {
          background: none; border: 1.5px dashed rgba(255,255,255,.18);
          border-radius: 12px; color: var(--haze); cursor: pointer;
          font-family: inherit; font-size: 13px; padding: 11px; width: 100%;
        }
        .us-add:hover { color: var(--plasma); border-color: var(--plasma); }
        .us-add:disabled { opacity: .4; cursor: default; }

        .us-callout {
          display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px;
          border-radius: 14px; padding: 14px 16px; margin-bottom: 14px;
          background: linear-gradient(100deg, rgba(70,229,200,.16), rgba(70,229,200,.04));
          border: 1.5px solid rgba(70,229,200,.45);
        }
        .us-callout.warn {
          background: linear-gradient(100deg, rgba(255,196,61,.16), rgba(255,196,61,.04));
          border-color: rgba(255,196,61,.45);
        }
        .us-callout.bad, .us-callout.flat {
          background: linear-gradient(100deg, rgba(255,107,44,.14), rgba(255,107,44,.03));
          border-color: rgba(255,107,44,.4);
        }
        .us-callout-k {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--haze); width: 100%;
        }
        .us-callout-v { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 26px; }
        .us-callout-n { font-family: 'DM Mono', monospace; font-size: 11.5px; color: var(--haze); }

        .us-match {
          background: var(--dusk-3);
          border-left: 3px solid var(--haze);
          border-radius: 12px; padding: 10px 12px; margin-bottom: 8px;
        }
        .us-match.good { border-left-color: var(--plasma); }
        .us-match.warn { border-left-color: var(--solgaleo); }
        .us-match.bad  { border-left-color: var(--rotom); opacity: .74; }
        .us-match-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .us-name { font-family: 'Baloo 2', sans-serif; font-weight: 600; font-size: 16px; }
        .us-verdict-tag {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: .06em; text-transform: uppercase; color: var(--haze);
        }
        .us-match.good .us-verdict-tag { color: var(--plasma); }
        .us-match.warn .us-verdict-tag { color: var(--solgaleo); }
        .us-match.bad  .us-verdict-tag { color: var(--rotom); }

        .us-chips { display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap; }
        .us-chip {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: .08em; text-transform: uppercase;
          padding: 3px 7px; border-radius: 5px; color: #12102A; font-weight: 500;
        }
        .us-lines {
          font-family: 'DM Mono', monospace; font-size: 11.5px; margin-top: 7px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .us-lines b { font-weight: 500; margin-right: 6px; }
        .us-arrow { display: inline-block; width: 46px; color: var(--haze); letter-spacing: .04em; }
        .us-via { color: #7E71AE; }
        .us-cause { color: var(--solgaleo); font-size: 10.5px; margin-top: 3px; }

        .us-game { margin-bottom: 18px; }
        .us-game .us-sel {
          font-family: 'DM Mono', monospace; font-size: 12px;
          letter-spacing: .04em; color: var(--solgaleo);
          border-color: rgba(255,196,61,.4); background: var(--dusk-2);
        }

        .us-suggest { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .us-suggest button {
          width: 100%; text-align: left; background: var(--dusk);
          border: 1px solid rgba(255,255,255,.1); border-radius: 10px;
          color: var(--paper); cursor: pointer; font-family: inherit;
          font-size: 14px; padding: 9px 11px;
          display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
        }
        .us-suggest button:hover, .us-suggest button:focus-visible {
          background: var(--rotom); border-color: var(--rotom); outline: none;
        }
        .us-suggest-t {
          font-family: 'DM Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: .06em; color: var(--haze);
        }

        .us-empty {
          border: 1.5px dashed rgba(255,255,255,.14); border-radius: 14px;
          color: var(--haze); font-size: 13px; padding: 22px 16px;
          text-align: center; line-height: 1.5;
        }
      `}</style>

      <p className="us-eyebrow">Pokémon · any game</p>
      <h1 className="us-title">Who do I send in?</h1>
      <p className="us-sub">
        {HAS_LIBRARY
          ? "Search your party once. Name what you're facing and it ranks your six."
          : "Set your party's types once. Name what you're facing and it ranks your six."}
        {saves ? " Saved between sessions." : ""}
      </p>

      {HAS_LIBRARY && (
        <div className="us-game">
          <select
            className="us-sel"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            aria-label="Which game are you playing?"
          >
            <option value="">Every Pokémon</option>
            {[...GAMES].reverse().map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <p className="us-note" style={{ margin: "8px 0 0" }}>
            {game
              ? "Search only returns Pokémon you can get in this game."
              : "Search covers every Pokémon. Pick a game to narrow it."}
          </p>
        </div>
      )}

      <section className="us-panel opp">
        <h2 className="us-h2">Facing</h2>
        <p className="us-note">Their types decide everything below.</p>
        <MonRow mon={opp} onChange={setOpp} types={TYPES} game={game} placeholder="Their Pokémon (optional)" />
      </section>

      <section className="us-panel">
        <h2 className="us-h2">Your party</h2>
        <p className="us-note">
          Type is all that's required. Ability and speed sharpen the call when they matter —
          speed decides the rows where you both hit hard.
        </p>
        {team.map((m, i) => (
          <MonRow
            key={m.id}
            mon={m}
            onChange={update}
            onRemove={() => removeSlot(m.id)}
            types={TYPES}
            game={game}
            placeholder={`Slot ${i + 1} (optional)`}
          />
        ))}
        <button className="us-add" onClick={addSlot} disabled={team.length >= MAX_TEAM}>
          {team.length >= MAX_TEAM ? "Party is full" : "Add another"}
        </button>
      </section>

      <section className="us-panel">
        <h2 className="us-h2">The call</h2>
        {!ready || matchups.length === 0 ? (
          <div className="us-empty">
            {!ready
              ? "Set the opposing Pokémon's type to see the ranking."
              : "Give at least one of your party a type."}
          </div>
        ) : (
          <>
            <div className={`us-callout ${verdict(best).tone}`}>
              <span className="us-callout-k">Send in</span>
              <span className="us-callout-v">{best.display}</span>
              <span className="us-callout-n">
                deals {fmt(best.deal)}, takes {fmt(best.take)}
                {best.faster === true ? ", moves first"
                  : best.faster === false ? ", moves second" : ""}
              </span>
            </div>

            {matchups.map((m) => {
              const v = verdict(m);
              return (
                <div className={`us-match ${v.tone}`} key={m.id}>
                  <div className="us-match-top">
                    <span className="us-name">{m.display}</span>
                    <span className="us-verdict-tag">{v.label}</span>
                  </div>
                  <div className="us-chips">
                    {m.mine.map((t) => (
                      <span key={t} className="us-chip" style={{ background: TYPE_COLOR[t] }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="us-lines">
                    <div>
                      <span className="us-arrow">deals</span>
                      <b>{fmt(m.deal)}</b>
                      <span className="us-via">{m.deal >= 2 ? `via ${m.dealBy.join(" / ")}` : ""}</span>
                    </div>
                    <div>
                      <span className="us-arrow">takes</span>
                      <b>{fmt(m.take)}</b>
                      <span className="us-via">{m.take >= 2 ? `from ${m.takeBy.join(" / ")}` : ""}</span>
                    </div>
                    {m.faster !== null && (
                      <div>
                        <span className="us-arrow">speed</span>
                        <b>{m.speed}</b>
                        <span className="us-via">
                          {m.faster ? "you move first" : "they move first"}
                        </span>
                      </div>
                    )}
                    {m.swung && m.cause.map((c) => (
                      <div key={c} className="us-cause">✦ {c}</div>
                    ))}
                  </div>
                </div>
              );
            })}

            <p className="us-note" style={{ marginTop: 14, marginBottom: 0 }}>
              Types, abilities and speed only — no levels, items, weather or actual movesets.
              A first read, not a damage calc.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
