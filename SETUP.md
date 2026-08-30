# Getting this running

Same stack as TEMPO — React and Vite — so nothing new to install. No Tailwind
needed here; all the styling lives inside the component.

Work through one part at a time. Nothing later depends on you having read ahead.

---

## Part 1 — Make the project

Open a terminal, go wherever you keep TEMPO, and run:

```bash
npm create vite@latest pokemon-matchup -- --template react
cd pokemon-matchup
npm install
```

When Vite asks anything, take the defaults.

Check it works before going further:

```bash
npm run dev
```

Open the address it prints (usually `http://localhost:5173`). You should see
Vite's placeholder page. Press `Ctrl+C` in the terminal to stop it.

---

## Part 2 — Drop in the two files

Download `type-matchup.jsx` and `build-library.mjs` from the chat, then put them here:

```
pokemon-matchup/
├── build-library.mjs        ← project root
├── src/
│   ├── type-matchup.jsx     ← inside src
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

Now open `src/App.jsx`, delete everything in it, and paste this:

```jsx
import TypeMatchup from "./type-matchup.jsx";

export default function App() {
  return <TypeMatchup />;
}
```

Run `npm run dev` again. You should see the app, working exactly as it did in
chat — manual type dropdowns, no search yet. That's expected: the library
doesn't exist yet.

Persistence works from this point on. Add a Pokémon, reload the page, and it
should still be there.

---

## Part 3 — Build the library

This is the step that turns on name search and the game filter.

From the project root:

```bash
node build-library.mjs
```

It takes a few minutes and prints progress as it goes. It's making a lot of
requests, deliberately slowly, so leave it alone until it finishes. At the end
it writes `src/pokemon-library.json` and prints a summary like:

```
Wrote src/pokemon-library.json
  1302 Pokémon and forms across 40 games
  1289 scoped to at least one game
  480 KB
```

If it fails partway through, just run it again — it starts fresh each time.

Now tell the app to use it. Open `src/type-matchup.jsx` and find this line near
the top (around line 100):

```js
const LIBRARY = (typeof window !== "undefined" && window.POKEMON_LIBRARY) || null;
```

Replace it with:

```js
import LIBRARY from "./pokemon-library.json";
```

Move that `import` up to sit with the other import at the very top of the file —
imports have to come first.

Run `npm run dev` once more. The name fields should now be search boxes, and a
game picker should appear above them.

**This is the moment to sanity check the data.** Pick Ultra Sun from the game
list, then search:

- `ninetales` — should offer both Ninetales and Alolan Ninetales
- `rotom` — should offer all the appliance forms
- `sprigatito` — should return nothing, since it's not in Ultra Sun

If any of those look wrong, tell me what you got and I'll fix the script.

---

## Part 4 — Put it on GitHub

```bash
git init
git add .
git commit -m "Pokemon type matchup app"
```

Go to github.com, click **New repository**, name it `pokemon-matchup`, leave
everything else alone, and click Create. GitHub then shows you two commands to
copy — they look like:

```bash
git remote add origin https://github.com/YOURNAME/pokemon-matchup.git
git push -u origin main
```

Run those.

---

## Part 5 — Deploy

Go to vercel.com, **Add New → Project**, pick the `pokemon-matchup` repo, and
click Deploy. Vercel detects Vite on its own, so change nothing.

A minute later you get a URL. Open it on your phone and add it to your home
screen — that's the whole point of this, having it in your hand mid-battle.

From now on, `git push` redeploys automatically.

---

## When a new game comes out

```bash
node build-library.mjs
git add src/pokemon-library.json
git commit -m "Refresh library"
git push
```

---

## If something breaks

- **`node: command not found`** — Node isn't on your PATH in this terminal.
  Same Node that runs TEMPO, so try the terminal you use for that.
- **Blank white page** — open the browser console (F12) and read the first red
  error. It's almost always a wrong import path.
- **`Failed to resolve import "./pokemon-library.json"`** — Part 3 didn't finish.
  Check the file is actually in `src/`.
- **Search box never appears** — the `LIBRARY` line didn't get replaced, or the
  import isn't at the top of the file.

Paste me the error and I'll sort it.
