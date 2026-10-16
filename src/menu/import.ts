import { type Kobo, parseNairaToKobo } from "../lib/money";

export const MAX_IMPORT_ROWS = 500;
const HEADERS = ["dish", "category", "price in ₦", "portion", "extras"] as const;

export interface RawRow { [header: string]: unknown }
export interface ParsedItem {
  key: string; name: string; category: string; priceKobo: Kobo | null; portion: string | null;
  extras: { name: string; priceKobo: Kobo }[];
}
export interface RowIssue { row: number; level: "error" | "warning"; message: string }
export interface DryRunReport {
  ok: boolean; items: ParsedItem[]; issues: RowIssue[];
  counts: { rows: number; valid: number; errors: number; warnings: number; publishable: number; draftOnly: number };
}

const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
export const slugKey = (category: string, name: string) =>
  `${category}::${name}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9:]+/g, "-").replace(/^-+|-+$/g, "");
const looksLikeFormula = (s: string) => /^[=+\-@\t\r]/.test(s);

/** Extras cell format: "Extra beef:1500; Plantain:500" */
function parseExtras(cell: string, row: number, issues: RowIssue[]): ParsedItem["extras"] {
  if (!cell) return [];
  const out: ParsedItem["extras"] = [];
  for (const part of cell.split(";").map((p) => p.trim()).filter(Boolean)) {
    const idx = part.lastIndexOf(":");
    const name = idx > 0 ? part.slice(0, idx).trim() : "";
    const price = idx > 0 ? parseNairaToKobo(part.slice(idx + 1)) : null;
    if (!name || !price || !price.ok) {
      issues.push({ row, level: "error", message: `Extra "${part}" must look like "Name:1500"` });
      continue;
    }
    out.push({ name, priceKobo: price.kobo });
  }
  return out;
}

/** Pure, side-effect-free validation. Nothing is written until the owner confirms a clean dry run. */
export function dryRunImport(rows: RawRow[]): DryRunReport {
  const issues: RowIssue[] = [];
  const items: ParsedItem[] = [];
  if (rows.length === 0) {
    issues.push({ row: 0, level: "error", message: "The file has no menu rows" });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    issues.push({ row: 0, level: "error", message: `Too many rows (${rows.length}). Maximum is ${MAX_IMPORT_ROWS}` });
  } else {
    const first = rows[0] ?? {};
    const missing = HEADERS.filter((h) => !(h in first)).filter((h) => rows.length > 0);
    if (missing.length) issues.push({ row: 0, level: "error", message: `Missing columns: ${missing.join(", ")}` });
    else {
      const seen = new Map<string, number>();
      rows.forEach((r, i) => {
        const row = i + 2; // spreadsheet row number (header is row 1)
        const name = norm(r["dish"]);
        const category = norm(r["category"]);
        const priceCell = norm(r["price in ₦"]);
        const portion = norm(r["portion"]);
        const before = issues.length;
        if (!name) issues.push({ row, level: "error", message: "Dish name is empty" });
        if (!category) issues.push({ row, level: "error", message: "Category is empty" });
        for (const [label, v] of [["dish", name], ["category", category], ["portion", portion]] as const) {
          if (looksLikeFormula(v)) issues.push({ row, level: "error", message: `${label} starts with =, +, - or @ (spreadsheet formula risk)` });
        }
        if (name.length > 120) issues.push({ row, level: "error", message: "Dish name is longer than 120 characters" });
        let priceKobo: Kobo | null = null;
        if (priceCell === "") {
          issues.push({ row, level: "warning", message: "No price yet: will be saved as a draft and cannot be published" });
        } else {
          const p = parseNairaToKobo(priceCell);
          if (p.ok) priceKobo = p.kobo; else issues.push({ row, level: "error", message: `Price: ${p.error}` });
        }
        const extras = parseExtras(norm(r["extras"]), row, issues);
        if (name && category) {
          const key = slugKey(category, name);
          const dup = seen.get(key);
          if (dup) issues.push({ row, level: "error", message: `Duplicate of row ${dup} (same dish in same category)` });
          else seen.set(key, row);
          if (!issues.slice(before).some((x) => x.level === "error")) {
            items.push({ key, name, category, priceKobo, portion: portion || null, extras });
          }
        }
      });
    }
  }
  const errors = issues.filter((x) => x.level === "error").length;
  const warnings = issues.length - errors;
  const publishable = items.filter((i) => i.priceKobo !== null).length;
  return {
    ok: errors === 0, items, issues,
    counts: { rows: rows.length, valid: items.length, errors, warnings, publishable, draftOnly: items.length - publishable },
  };
}
