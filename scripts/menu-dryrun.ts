import ExcelJS from "exceljs";
import { dryRunImport, type RawRow } from "../src/menu/import";

const file = process.argv[2];
if (!file) { console.error("Usage: npm run menu:dryrun -- path/to/menu.xlsx"); process.exit(2); }
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];
if (!ws) { console.error("No sheet found"); process.exit(2); }
const headers: string[] = [];
ws.getRow(1).eachCell((c, n) => { headers[n] = String(c.value ?? "").trim(); });
const rows: RawRow[] = [];
ws.eachRow((row, n) => {
  if (n === 1) return;
  const r: RawRow = {};
  headers.forEach((h, i) => { if (h) { const v = row.getCell(i).value; r[h] = v && typeof v === "object" && "result" in v ? v.result : v; } });
  if (Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) rows.push(r);
});
const report = dryRunImport(rows);
console.log(JSON.stringify({ ...report, items: report.items.map((i) => ({ ...i, priceKobo: i.priceKobo?.toString() ?? null, extras: i.extras.map((e) => ({ ...e, priceKobo: e.priceKobo.toString() })) })) }, null, 2));
process.exit(report.ok ? 0 : 1);
