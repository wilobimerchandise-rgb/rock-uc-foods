import ExcelJS from "exceljs";
import { dryRunImport, type ImportRow } from "../src/menu/import";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run menu:dryrun -- <path-to-excel-file>");
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    console.error("No worksheet found in the file.");
    process.exit(1);
  }

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || "").trim();
  });

  const rows: ImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    const r: Record<string, any> = {};
    headers.forEach((h, i) => {
      if (h) {
        const v = row.getCell(i).value;
        r[h] = v && typeof v === "object" && "result" in v ? v.result : v;
      }
    });
    rows.push(r as ImportRow);
  });

  const result = dryRunImport(rows);
  
  console.log(`\n--- DRY RUN RESULTS ---`);
  console.log(`Rows processed: ${result.counts.rows}`);
  console.log(`Valid: ${result.counts.valid} (Publishable: ${result.counts.publishable}, Draft only: ${result.counts.draftOnly})`);
  console.log(`Warnings: ${result.counts.warnings}`);
  console.log(`Errors: ${result.counts.errors}`);
  
  if (result.issues.length > 0) {
    console.log(`\n--- ISSUES ---`);
    result.issues.forEach((issue) => {
      console.log(`[Row ${issue.row}] [${issue.level.toUpperCase()}] ${issue.message}`);
    });
  }

  if (result.ok) {
    console.log(`\n✅ Dry run successful. No errors found.`);
  } else {
    console.log(`\n❌ Dry run failed. Fix the errors above before importing.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
