import { parseNairaToKobo, type Kobo } from "../lib/money";

export interface ImportRow {
  sku?: string | null;
  category?: string | null;
  name?: string | null;
  dish?: string | null;
  description?: string | null;
  "price in ₦"?: string | number | null;
  price_ngn?: string | number | null;
  portion?: string | null;
  portion_label?: string | null;
  allergens?: string | null;
  status?: string | null;
  available?: string | boolean | null;
  featured?: string | boolean | null;
  sort_order?: string | number | null;
  extras?: string | null;
}

export interface ParsedItem {
  key: string;
  category: string;
  name: string;
  description: string;
  priceKobo: Kobo;
  portion_label: string;
  allergens: string[];
  status: "draft" | "published" | "archived";
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  extras: { name: string; priceKobo: Kobo }[];
}

export interface DryRunResult {
  ok: boolean;
  counts: {
    rows: number;
    valid: number;
    publishable: number;
    draftOnly: number;
    warnings: number;
    errors: number;
  };
  issues: { row: number; level: "error" | "warning"; message: string }[];
  items: ParsedItem[];
}

export const MAX_IMPORT_ROWS = 500;

export function dryRunImport(rows: ImportRow[]): DryRunResult {
  const result: DryRunResult = {
    ok: true,
    counts: { rows: rows.length, valid: 0, publishable: 0, draftOnly: 0, warnings: 0, errors: 0 },
    issues: [],
    items: [],
  };

  if (rows.length === 0) {
    result.ok = false;
    result.counts.errors = 1;
    result.issues.push({ row: 0, level: "error", message: "Missing columns or empty file" });
    return result;
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    result.ok = false;
    result.counts.errors = 1;
    result.issues.push({ row: 0, level: "error", message: `Exceeds maximum of ${MAX_IMPORT_ROWS} rows` });
    return result;
  }

  const seenNames = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    
    const row = i + 1;
    const name = String(r.name ?? r.dish ?? "").trim();
    const category = String(r.category ?? "").trim();
    const rawPrice = r["price in ₦"] ?? r.price_ngn;
    const priceStr = rawPrice !== null && rawPrice !== undefined ? String(rawPrice).trim() : "";

    if (!name || !category) {
      result.ok = false;
      result.counts.errors++;
      result.issues.push({ row, level: "error", message: "Missing columns" });
      continue;
    }

    const lowerName = name.toLowerCase().replace(/\s+/g, " ");
    const catLower = category.toLowerCase().replace(/\s+/g, " ");
    const nameKey = `${catLower}::${lowerName}`;

    if (seenNames.has(nameKey)) {
      result.ok = false;
      result.counts.errors++;
      result.issues.push({ row, level: "error", message: `Duplicate dish "${name}" in category "${category}"` });
      continue;
    }
    seenNames.set(nameKey, row);

    let priceKobo: Kobo = 0n;
    let isPublishable = false;

    if (priceStr) {
      const p = parseNairaToKobo(priceStr);
      if (p.ok) {
        if (p.kobo === 0n) {
          result.ok = false;
          result.counts.errors++;
          result.issues.push({ row, level: "error", message: "Price cannot be 0" });
          continue;
        }
        priceKobo = p.kobo;
        isPublishable = true;
      } else {
        result.ok = false;
        result.counts.errors++;
        result.issues.push({ row, level: "error", message: `Price: ${p.error}` });
        continue;
      }
    } else {
      result.counts.warnings++;
      result.issues.push({ row, level: "warning", message: "No price provided, will import as draft" });
    }

    const status = String(r.status ?? "draft").toLowerCase() as "draft" | "published" | "archived";
    const is_available = String(r.available ?? "true").toLowerCase() === "true";
    const is_featured = String(r.featured ?? "false").toLowerCase() === "true";
    const sort_order = parseInt(String(r.sort_order ?? "0"), 10) || 0;

    const extras: { name: string; priceKobo: Kobo }[] = [];
    if (r.extras !== null && r.extras !== undefined && String(r.extras).trim()) {
      const extraParts = String(r.extras).split(";");
      let extrasValid = true;
      for (const part of extraParts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;
        const colonIdx = trimmedPart.indexOf(":");
        if (colonIdx === -1) {
          result.ok = false;
          result.counts.errors++;
          result.issues.push({ row, level: "error", message: `Malformed extras: "${trimmedPart}". Expected "Name:Price"` });
          extrasValid = false;
          break;
        }
        const eName = trimmedPart.substring(0, colonIdx).trim();
        const ePrice = trimmedPart.substring(colonIdx + 1).trim();
        
        const ep = parseNairaToKobo(ePrice);
        if (ep.ok) {
          extras.push({ name: eName, priceKobo: ep.kobo });
        } else {
          result.ok = false;
          result.counts.errors++;
          result.issues.push({ row, level: "error", message: `Invalid extra price for "${eName}": ${ep.error}` });
          extrasValid = false;
          break;
        }
      }
      if (!extrasValid) continue;
    }

    if (/^[=+\-@]/.test(name) || /^[=+\-@]/.test(category)) {
      result.ok = false;
      result.counts.errors++;
      result.issues.push({ row, level: "error", message: "Formula injection detected in name or category" });
      continue;
    }

    const item: ParsedItem = {
      key: String(r.sku ?? "").trim() || nameKey,
      category,
      name,
      description: String(r.description ?? "").trim(),
      priceKobo,
      portion_label: String(r.portion_label ?? r.portion ?? "").trim(),
      allergens: (r.allergens !== null && r.allergens !== undefined && String(r.allergens).trim()) 
        ? String(r.allergens).split(",").map(a => a.trim()) 
        : [],
      status: isPublishable ? (status === "published" ? "published" : "draft") : "draft",
      is_available,
      is_featured,
      sort_order,
      extras,
    };

    result.counts.valid++;
    if (isPublishable) {
      result.counts.publishable++;
    } else {
      result.counts.draftOnly++;
    }

    result.items.push(item);
  }

  return result;
}
