import { describe, it, expect } from "vitest";
import { dryRunImport, MAX_IMPORT_ROWS } from "../src/menu/import";

const row = (o: Record<string, unknown> = {}) => ({ dish: "Semo & Egusi", category: "Soups & Swallow", "price in ₦": 3500, portion: "Regular", extras: null, ...o });

describe("dryRunImport", () => {
  it("accepts a clean row; price becomes kobo", () => {
    const r = dryRunImport([row()]);
    expect(r.ok).toBe(true);
    expect(r.items[0]!.priceKobo).toBe(350000n);
  });
  it("the owner's real template (3 dishes, no prices): ok, 0 publishable, 3 drafts, 3 warnings", () => {
    const r = dryRunImport([
      { dish: "Semo & Egusi", category: "Soups & Swallow", "price in ₦": null, portion: null, extras: null },
      { dish: "Party Jollof Rice & Grilled Chicken", category: "Rice Meals", "price in ₦": null, portion: null, extras: null },
      { dish: "Peppered Meat", category: "Sides / Proteins", "price in ₦": null, portion: null, extras: null },
    ]);
    expect(r.ok).toBe(true);
    expect(r.counts).toMatchObject({ rows: 3, valid: 3, publishable: 0, draftOnly: 3, warnings: 3, errors: 0 });
  });
  it("empty file is an error", () => expect(dryRunImport([]).ok).toBe(false));
  it("over the row cap is an error", () => expect(dryRunImport(Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => row({ dish: `D${i}` }))).ok).toBe(false));
  it("exactly the cap is allowed", () => expect(dryRunImport(Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => row({ dish: `D${i}` }))).ok).toBe(true));
  it("missing column", () => {
    const r = dryRunImport([{ dish: "A", category: "B" }]);
    expect(r.ok).toBe(false); expect(r.issues[0]!.message).toContain("Missing columns");
  });
  it("duplicate dish in same category (case/space-insensitive) errors; same dish in other category is fine", () => {
    expect(dryRunImport([row(), row({ dish: "  semo &  egusi " })]).ok).toBe(false);
    expect(dryRunImport([row(), row({ category: "Other" })]).ok).toBe(true);
  });
  it.each(["abc", "-5", "0", "1.999"])("bad price %j errors", (p) => expect(dryRunImport([row({ "price in ₦": p })]).ok).toBe(false));
  it("formula injection in dish name is blocked", () => expect(dryRunImport([row({ dish: "=HYPERLINK(\"x\")" })]).ok).toBe(false));
  it("empty dish / category error", () => {
    expect(dryRunImport([row({ dish: "" })]).ok).toBe(false);
    expect(dryRunImport([row({ category: " " })]).ok).toBe(false);
  });
  it("extras parse; malformed extras error", () => {
    const ok = dryRunImport([row({ extras: "Extra beef:1,500; Plantain:500" })]);
    expect(ok.items[0]!.extras).toEqual([{ name: "Extra beef", priceKobo: 150000n }, { name: "Plantain", priceKobo: 50000n }]);
    expect(dryRunImport([row({ extras: "Plantain" })]).ok).toBe(false);
    expect(dryRunImport([row({ extras: "Plantain:abc" })]).ok).toBe(false);
  });
  it("is deterministic/idempotent: same input gives same keys", () => {
    expect(dryRunImport([row()]).items[0]!.key).toBe(dryRunImport([row()]).items[0]!.key);
  });
});
