# Battle Advantage

A Pokémon type matchup advisor. Set your party once, name what you're facing,
and it ranks your six by who to send in — accounting for dual types, abilities
and base speed.

**Live:** https://pokemon-matchup-rho.vercel.app

Built to be useful with a phone in one hand and a game in the other, so it
works offline and makes no network calls at runtime.

---

## What it does

- **Ranks your party against one opponent.** Every party member gets what it
  deals, what it takes, and who moves first, sorted best matchup first.
- **Accounts for abilities.** Twenty-two abilities that actually change a
  multiplier are modelled — Levitate, Thick Fat, Wonder Guard, Mold Breaker
  and the rest. When an ability is the reason a matchup reads the way it does,
  the app says so.
- **Scopes to the game you're playing.** Pick from 53 games and search only
  returns Pokémon you can get in that one. Regional forms are handled, so
  Galarian Ponyta won't appear in Emerald.
- **Remembers your party** between sessions.

It reads types, abilities and base speed. It does not know levels, held items,
weather or actual movesets — it's a first read, not a damage calculator.

---

## How the data works

The interesting part isn't the app, it's where its data comes from.

`build-library.mjs` is run once and fetches from [PokéAPI](https://pokeapi.co),
resolving three separate endpoint families and joining them:

| Endpoint | Gives us |
|---|---|
| `/version-group` | the 53 playable games and their ordering |
| `/pokedex` | which species appear in which game |
| `/pokemon` | types, base speed, abilities, and every regional form |

The result is written to `src/pokemon-library.json` — 1,320 Pokémon and forms,
about 318 KB — and committed to the repo. **The app imports that file and never
touches the network again.**

That's a deliberate trade. Freshness is sacrificed (a new generation means
re-running the script) in exchange for:

- working offline, which is the whole point of a companion app
- no latency or rate limits, since there's no request in the hot path
- no dependency on someone else's uptime
- following PokéAPI's own fair use policy, which asks callers to cache locally

### The bit that needed two sources

Pokédex data is species-level, so it alone would happily tell you Galarian
Ponyta belongs in Emerald — Ponyta is in that dex, after all. So each form also
carries the game that introduced it, and availability requires both conditions:
the species is in that game's dex, *and* the form existed by then.

This scopes to what's in a game's Pokédex, not what's catchable on your
particular save. Version exclusives from both paired games appear.

---

## Running it

Requires Node 18+.

```bash
npm install
npm run dev
```

The library is already committed, so it works immediately. To rebuild it —
after a new game releases, for instance:

```bash
node build-library.mjs
```

Takes a few minutes; it deliberately runs eight requests at a time rather than
firing off 1,400 at once.

---

## Tests

```bash
npm test
```

The type chart is 18 lines of data that silently decide every answer the app
gives. A wrong cell doesn't crash anything — it just quietly produces bad
advice. So `typechart.js` holds the chart, the ability table and the resolution
logic as pure functions with no React, and `typechart.test.js` covers them:

- chart integrity — every row present, every defender key a real type, every
  value one of 0, ½ or 2 (catching typos that would otherwise fall through to
  neutral damage unnoticed)
- all eight type immunities
- dual-type multiplication, including 4x stacking and weakness/resistance cancelling
- every modelled ability, and the ordering between them — Mold Breaker
  cancelling Levitate, Tinted Lens never reviving an immunity, Wonder Guard
  evaluating the final multiplier rather than the raw one

---

## Layout

```
build-library.mjs        one-time fetch; writes src/pokemon-library.json
src/
  typechart.js           chart, abilities, resolve() and verdict() — pure, no React
  typechart.test.js      the suite above
  type-matchup.jsx       the app; presentation only
  pokemon-library.json   generated, committed
  trainers.json          unused; see its readme
```

`trainers.json` holds 46 major Alola battles, about half verified against
Serebii and half written from memory and explicitly flagged as unreliable. The
feature was removed from the app but the data was kept — there is no API for
trainer teams and no decompilation for 3DS games, so it can't be regenerated.

---

## Credits

Pokémon names, types, abilities and base stats from
[PokéAPI](https://pokeapi.co). Trainer team data checked against
[Serebii.net](https://www.serebii.net).

Pokémon is a trademark of Nintendo, Game Freak and Creatures Inc. This is an
unofficial personal project with no affiliation to any of them.
