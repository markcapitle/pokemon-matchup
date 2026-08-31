import { describe, it, expect } from "vitest";
import { TYPES, CHART, ABILITY, resolve, verdict } from "./typechart.js";

/* Shorthand: raw chart answer, no abilities on either side. */
const raw = (atk, ...def) => resolve(atk, def, null, null);

describe("chart integrity", () => {
  it("has all eighteen types", () => {
    expect(TYPES).toHaveLength(18);
    expect(new Set(TYPES).size).toBe(18);
  });

  it("has a row for every type", () => {
    for (const t of TYPES) expect(CHART[t], `missing row: ${t}`).toBeDefined();
  });

  /* Guards against a typo in a defender key, which would otherwise fall
     through to the 1x default and never be noticed. */
  it("only names real types as defenders", () => {
    for (const [atk, row] of Object.entries(CHART)) {
      for (const def of Object.keys(row)) {
        expect(TYPES, `${atk} -> ${def}`).toContain(def);
      }
    }
  });

  it("only uses 0, half or double against a single type", () => {
    for (const row of Object.values(CHART)) {
      for (const v of Object.values(row)) expect([0, 0.5, 2]).toContain(v);
    }
  });
});

describe("single type matchups", () => {
  it("resolves super effective hits", () => {
    expect(raw("fire", "grass")).toBe(2);
    expect(raw("water", "fire")).toBe(2);
    expect(raw("fighting", "steel")).toBe(2);
    expect(raw("fairy", "dragon")).toBe(2);
  });

  it("resolves resisted hits", () => {
    expect(raw("fire", "water")).toBe(0.5);
    expect(raw("grass", "steel")).toBe(0.5);
    expect(raw("dark", "fairy")).toBe(0.5);
  });

  it("resolves every immunity", () => {
    expect(raw("normal", "ghost")).toBe(0);
    expect(raw("fighting", "ghost")).toBe(0);
    expect(raw("ghost", "normal")).toBe(0);
    expect(raw("electric", "ground")).toBe(0);
    expect(raw("ground", "flying")).toBe(0);
    expect(raw("poison", "steel")).toBe(0);
    expect(raw("psychic", "dark")).toBe(0);
    expect(raw("dragon", "fairy")).toBe(0);
  });

  it("treats unlisted pairings as neutral", () => {
    expect(raw("normal", "water")).toBe(1);
    expect(raw("psychic", "grass")).toBe(1);
  });
});

describe("dual type matchups multiply", () => {
  it("stacks two weaknesses to 4x", () => {
    expect(raw("fire", "grass", "steel")).toBe(4);      // Ferrothorn
    expect(raw("rock", "fire", "flying")).toBe(4);      // Charizard
    expect(raw("electric", "water", "flying")).toBe(4); // Gyarados
  });

  it("stacks two resistances to a quarter", () => {
    expect(raw("grass", "fire", "flying")).toBe(0.25);
  });

  it("cancels a weakness against a resistance", () => {
    expect(raw("ice", "ice", "ground")).toBe(1);        // Mamoswine
  });

  it("lets an immunity beat any number of weaknesses", () => {
    expect(raw("ground", "steel", "flying")).toBe(0);   // Skarmory
  });
});

describe("defensive abilities", () => {
  it("Levitate blanks Ground", () => {
    expect(raw("ground", "electric", "ghost")).toBe(2);
    expect(resolve("ground", ["electric", "ghost"], "levitate", null)).toBe(0);
  });

  it("absorbing abilities blank their type", () => {
    expect(resolve("fire", ["normal"], "flash-fire", null)).toBe(0);
    expect(resolve("water", ["normal"], "water-absorb", null)).toBe(0);
    expect(resolve("electric", ["normal"], "volt-absorb", null)).toBe(0);
    expect(resolve("grass", ["normal"], "sap-sipper", null)).toBe(0);
  });

  it("Thick Fat halves Fire and Ice only", () => {
    expect(resolve("ice", ["ice", "ground"], "thick-fat", null)).toBe(0.5);
    expect(resolve("fire", ["normal"], "thick-fat", null)).toBe(0.5);
    expect(resolve("water", ["normal"], "thick-fat", null)).toBe(1);
  });

  it("Dry Skin absorbs Water but worsens Fire", () => {
    expect(resolve("water", ["normal"], "dry-skin", null)).toBe(0);
    expect(resolve("fire", ["normal"], "dry-skin", null)).toBe(1.25);
  });

  it("Fluffy doubles Fire", () => {
    expect(resolve("fire", ["normal"], "fluffy", null)).toBe(2);
  });

  it("dampening softens super effective hits and leaves the rest alone", () => {
    expect(resolve("fire", ["grass"], "solid-rock", null)).toBe(1.5);
    expect(resolve("ice", ["dragon"], "prism-armor", null)).toBe(1.5);
    expect(resolve("normal", ["normal"], "filter", null)).toBe(1);
    expect(resolve("fire", ["water"], "filter", null)).toBe(0.5);
  });

  it("Wonder Guard blocks anything not super effective", () => {
    expect(resolve("normal", ["bug", "ghost"], "wonder-guard", null)).toBe(0);
    expect(resolve("fire", ["bug", "ghost"], "wonder-guard", null)).toBe(2);
    expect(resolve("water", ["bug", "ghost"], "wonder-guard", null)).toBe(0);
  });
});

describe("offensive abilities", () => {
  it("Mold Breaker ignores the defender's ability", () => {
    expect(resolve("ground", ["electric", "ghost"], "levitate", "mold-breaker")).toBe(2);
    expect(resolve("fire", ["normal"], "flash-fire", "teravolt")).toBe(1);
    expect(resolve("fire", ["grass"], "solid-rock", "turboblaze")).toBe(2);
  });

  it("Scrappy lets Normal and Fighting through Ghost", () => {
    expect(resolve("normal", ["ghost"], null, "scrappy")).toBe(1);
    expect(resolve("fighting", ["ghost", "poison"], null, "scrappy")).toBe(0.5); // Gengar
  });

  it("Scrappy does not help other types", () => {
    expect(resolve("psychic", ["dark"], null, "scrappy")).toBe(0);
  });

  it("Tinted Lens doubles resisted hits only", () => {
    expect(resolve("grass", ["fire"], null, "tinted-lens")).toBe(1);
    expect(resolve("fire", ["grass"], null, "tinted-lens")).toBe(2);
    expect(resolve("normal", ["normal"], null, "tinted-lens")).toBe(1);
  });

  it("Tinted Lens never revives an immunity", () => {
    expect(resolve("normal", ["ghost"], null, "tinted-lens")).toBe(0);
    expect(resolve("ground", ["normal"], "levitate", "tinted-lens")).toBe(0);
  });
});

describe("unknown abilities change nothing", () => {
  it("ignores an ability that isn't modelled", () => {
    expect(resolve("fire", ["grass"], "blaze", "overgrow")).toBe(2);
    expect(resolve("fire", ["grass"], null, null)).toBe(2);
  });

  it("every ability entry has a note for the UI", () => {
    for (const [name, a] of Object.entries(ABILITY)) {
      expect(a.note, `${name} has no note`).toBeTruthy();
    }
  });
});

describe("verdict", () => {
  it("calls an immunity a free switch-in above all else", () => {
    expect(verdict({ deal: 0.5, take: 0, faster: false }).label).toBe("Free switch-in");
  });

  it("leads with a clean advantage", () => {
    expect(verdict({ deal: 2, take: 0.5, faster: null }).label).toBe("Lead with this");
    expect(verdict({ deal: 2, take: 1, faster: null }).label).toBe("Good matchup");
  });

  it("uses speed to break a mutual 2x", () => {
    expect(verdict({ deal: 2, take: 2, faster: true }).label).toBe("Race — you're faster");
    expect(verdict({ deal: 2, take: 2, faster: false }).label).toBe("Race — they're faster");
  });

  it("asks for speeds rather than guessing", () => {
    expect(verdict({ deal: 2, take: 2, faster: null }).label)
      .toBe("Race — add speeds to call it");
  });

  it("warns off bad matchups", () => {
    expect(verdict({ deal: 1, take: 2, faster: true }).label).toBe("Keep out");
    expect(verdict({ deal: 0.5, take: 1, faster: true }).label).toBe("Can't break it");
  });

  it("falls through to even", () => {
    expect(verdict({ deal: 1, take: 1, faster: null }).label).toBe("Even");
  });

  it("always returns a tone the stylesheet knows", () => {
    const tones = ["good", "warn", "bad", "flat"];
    for (const deal of [0, 0.5, 1, 2, 4]) {
      for (const take of [0, 0.5, 1, 2, 4]) {
        for (const faster of [true, false, null]) {
          expect(tones).toContain(verdict({ deal, take, faster }).tone);
        }
      }
    }
  });
});
