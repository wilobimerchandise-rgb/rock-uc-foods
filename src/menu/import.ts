import { parseNairaToKobo, type Kobo } from "../lib/money";

export interface ImportRow {
  sku?: string;
  category: string;
  name?: string;
  dish?: string; // Alias for name to support template variations
  description?: string;
  price_ngn?: string;
  portion_label?: string;
  allergens?: string;
  status?: string;
  available?: string;
  featured?: string;
  sort_order?: string;
  extras?: string;
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
  toCreate: ParsedItem[];
  toUpdate: { key: string; oldPriceKobo: Kobo; newPriceKobo: Kobo }[];
  rejected: { row: number; level: "error" | "warning"; message: string }[];
  items: ParsedItem[];
}

export function dryRunImport(rows: ImportRow[], maxRows = 500): DryRunResult {
  const result: DryRunResult = { ok: true, toCreate: [], toUpdate: [], rejected: [], items: [] };
  
  if (rows.length === 0) {
    result.ok = false;
    result.rejected.push({ row: 0, level: "error", message: "File is empty" });
    return result;
  }

  if (rows.length > maxRows) {
    result.ok = false;
    result.rejected.push({ row: 0, level: "error", message: `Exceeds maximum of ${maxRows} rows` });
    return result;
  }

  const seenNames = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const row = i + 1;
    const name = ((r.name || r.dish) || "").trim();
    const category = (r.category || "").trim();
    const priceStr = (r.price_ngn || "").trim();

    if (!name || !category) {
      result.ok = false;
      result.rejected.push({ row, level: "error", message: "Missing name or category" });
      continue;
    }

    const lowerName = name.toLowerCase().replace(/\s+/g, " ");
    const catLower = category.toLowerCase().replace(/\s+/g, " ");
    const nameKey = `${catLower}::${lowerName}`;

    if (seenNames.has(nameKey)) {
      result.ok = false;
      result.rejected.push({ row, level: "error", message: `Duplicate dish "${name}" in category "${category}"` });
      continue;
    }
    seenNames.set(nameKey, row);

    let priceKobo: Kobo = 0n;
    if (priceStr) {
      const p = parseNairaToKobo(priceStr);
      if (p.ok) {
        if (p.kobo === 0n) {
          result.ok = false;
          result.rejected.push({ row, level: "error", message: "Price cannot be 0" });
          continue;
        }
        priceKobo = p.kobo;
      } else {
        result.ok = false;
        result.rejected.push({ row, level: "error", message: `Price: ${p.error}` });
        continue;
      }
    }

    const status = (r.status || "draft").toLowerCase() as "draft" | "published" | "archived";
    const is_available = (r.available || "true").toLowerCase() === "true";
    const is_featured = (r.featured || "false").toLowerCase() === "true";
    const sort_order = parseInt(r.sort_order || "0", 10) || 0;

    const extras: { name: string; priceKobo: Kobo }[] = [];
    if (r.extras && r.extras.trim()) {
      const extraParts = r.extras.split(";");
      for (const part of extraParts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;
        const colonIdx = trimmedPart.indexOf(":");
        if (colonIdx === -1) {
          result.ok = false;
          result.rejected.push({ row, level: "error", message: `Malformed extra: "${trimmedPart}". Expected "Name:Price"` });
          break;
        }
        const eName = trimmedPart.substring(0, colonIdx).trim();
        const ePrice = trimmedPart.substring(colonIdx + 1).trim();
        
        const ep = parseNairaToKobo(ePrice);
        if (ep.ok) {
          extras.push({ name: eName, priceKobo: ep.kobo });
        } else {
          result.ok = false;
          result.rejected.push({ row, level: "error", message: `Invalid extra price for "${eName}": ${ep.error}` });
          break;
        }
      }
    }

    if (/^[=+\-@]/.test(name) || /^[=+\-@]/.test(category)) {
      result.ok = false;
      result.rejected.push({ row, level: "error", message: "Formula injection detected in name or category" });
      continue;
    }

    const item: ParsedItem = {
      key: (r.sku || "").trim() || nameKey,
      category,
      name,
      description: (r.description || "").trim(),
      priceKobo,
      portion_label: (r.portion_label || "").trim(),
      allergens: (r.allergens || "").trim() ? (r.allergens || "").split(",").map(a => a.trim()) : [],
      status: status === "published" || status === "archived" ? status : "draft",
      is_available,
      is_featured,
      sort_order,
      extras,
    };

    if (!priceStr) {
      result.rejected.push({ row, level: "warning", message: "No price provided, will import as draft" });
      item.status = "draft";
    }

    result.items.push(item);
    result.toCreate.push(item);
  }

  return result;
}
