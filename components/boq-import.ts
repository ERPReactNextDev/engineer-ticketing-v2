import type { BoqRow, BoqSection } from "./job-fill-up-form-dialog";

/**
 * BOQ IMPORT (Excel file drop / file picker / Ctrl+V of copied cells)
 *
 * Sheet layout it understands (Sample_JR_Form_v2.xlsx):
 *
 *   I. GENERAL REQUIREMENTS                 <- title row (pink bar)  -> section title
 *   ITEM NO. | DESCRIPTION | Quantity | Unit | Material Cost | Total Material Cost | Labor Cost | ...
 *   1 | Mobilization... | 4 | trips | 69 | 276 | 0 | 0 | 725 | 2900 | 3176   <- item rows
 *   (text only row)                          <- group heading, kept as description-only row
 *   SUBTOTAL AMOUNT | MATERIAL COST | ...    <- skipped
 *   II. CIVIL WORKS ...                      <- next section
 *   MATERIAL COST / LABOR COST / ...         <- project summary at the bottom, ignored
 *
 * Columns are found by their header NAME, so the sheet can start in any column.
 * The "Total ..." columns are ignored: the form recomputes them.
 */

export type ImportedSection = {
  title: string;
  rows: Omit<BoqRow, "id">[];
};

type ColMap = {
  desc: number;
  qty: number;
  unit: number;
  material: number;
  labor: number;
  consumable: number;
};

// Used only when a header label is missing:
// No | Description | Qty | Unit | Material | TotalMaterial | Labor | TotalLabor | Consumable | ...
const DEFAULT_COLS: ColMap = { desc: 1, qty: 2, unit: 3, material: 4, labor: 6, consumable: 8 };
// Same, but when the copied range starts at the Description column
const DEFAULT_COLS_NO_ITEMNO: ColMap = { desc: 0, qty: 1, unit: 2, material: 3, labor: 5, consumable: 7 };

const SUBTOTAL_RE = /^sub\s*-?\s*total/i;
const SUMMARY_RE =
  /^(material cost|labou?r cost|consumables?|direct cost|contingency|total project cost|cost per item)\s*:?$/i;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const cellAt = (row: string[], i: number) => (i >= 0 ? str(row[i]) : "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** "₱1,234.5" / 1234.5 -> "1234.50"; anything non-numeric -> "" */
const toDecimal = (v: string) => {
  const cleaned = v.replace(/php|₱|,|\s/gi, "");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return "";
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? "" : n.toFixed(2);
};

/** Is this the column-header row? If yes, where is each column? */
function detectHeader(row: string[]): ColMap | null {
  const labels = Array.from(row, (c) => norm(str(c)));
  const find = (re: RegExp) => labels.findIndex((l) => re.test(l));

  const qty = find(/^(qty|quantity)$/);
  if (qty < 0) return null;

  const descLabel = find(/description|particulars/);
  const itemNo = find(/^(item no|item|no)$/);
  const unitLabel = find(/^(unit|uom|unit of measure(ment)?)$/);
  // "Total Material Cost" starts with "total", so it never matches these
  const materialLabel = find(/^material( cost)?$/);
  const laborLabel = find(/^labou?r( cost)?$/);
  const consumableLabel = find(/^consumables?( cost)?$/);

  // A header row = a Quantity label plus at least 2 other known labels.
  // (The DESCRIPTION cell can be empty/merged in some sections, so it is not required.)
  const known = [descLabel, itemNo, unitLabel, materialLabel, laborLabel, consumableLabel].filter((i) => i >= 0);
  if (known.length < 2) return null;

  const pick = (i: number, fallback: number) => (i >= 0 ? i : fallback);

  return {
    // Description label missing -> it is the column right after Item No.
    desc: descLabel >= 0 ? descLabel : itemNo >= 0 ? itemNo + 1 : DEFAULT_COLS.desc,
    qty,
    unit: pick(unitLabel, DEFAULT_COLS.unit),
    material: pick(materialLabel, DEFAULT_COLS.material),
    labor: pick(laborLabel, DEFAULT_COLS.labor),
    consumable: pick(consumableLabel, DEFAULT_COLS.consumable),
  };
}

/** Section title = the row right above the header row (the pink bar) */
function readTitle(grid: string[][], headerIdx: number): string {
  const row = grid[headerIdx - 1];
  if (!row) return "";
  const filled = Array.from(row, str).filter(Boolean);
  if (filled.length === 0 || filled.length > 2) return "";
  if (filled.some((c) => SUBTOTAL_RE.test(c) || SUMMARY_RE.test(c))) return "";
  // The form numbers sections itself (I., II., III.), so drop the leading numeral
  return filled.join(" ").replace(/^(?:[IVXLCDM]+|\d+)[.)]\s*/, "").trim();
}

function parseRows(rows: string[][], cols: ColMap): Omit<BoqRow, "id">[] {
  const out: Omit<BoqRow, "id">[] = [];

  for (const r of rows) {
    const cells = Array.from(r, str);
    if (cells.every((c) => !c)) continue; // blank row

    const qtyRaw = cellAt(cells, cols.qty);

    // Totals rows have labels OUTSIDE the Description column and no quantity.
    // (An item whose description is just "Consumable" must NOT be mistaken for the summary.)
    if (!qtyRaw) {
      const others = cells.filter((_, i) => i !== cols.desc);
      if (others.some((c) => SUBTOTAL_RE.test(c))) continue; // section subtotal
      const hasNumber = others.some((c) => toDecimal(c) !== "");
      if (hasNumber && others.some((c) => SUMMARY_RE.test(c))) break; // project summary -> stop
    }

    const row: Omit<BoqRow, "id"> = {
      description: cellAt(cells, cols.desc),
      qty: toDecimal(qtyRaw),
      unit: cellAt(cells, cols.unit),
      materialCost: toDecimal(cellAt(cells, cols.material)),
      laborCost: toDecimal(cellAt(cells, cols.labor)),
      consumableCost: toDecimal(cellAt(cells, cols.consumable)),
    };

    const hasData = row.qty || row.unit || row.materialCost || row.laborCost || row.consumableCost;

    if (!row.description && !hasData) {
      // Group heading: its text sits in a merged cell (often in the Item No. column)
      const label = cells.find((c) => c && !/^\d+(\.\d+)*\.?$/.test(c));
      if (!label) continue;
      row.description = label;
    }

    out.push(row);
  }

  return out;
}

/**
 * Parse a 2D grid into sections and rows.
 */
export function parseBoqGrid(rawGrid: unknown[][]): ImportedSection[] {
  const grid: string[][] = rawGrid.map((r) => (Array.isArray(r) ? Array.from(r, str) : []));

  const headers: { idx: number; cols: ColMap }[] = [];
  grid.forEach((row, idx) => {
    const cols = detectHeader(row);
    if (cols) headers.push({ idx, cols });
  });

  // No header row (only item rows were copied) -> one section with default columns
  if (headers.length === 0) {
    const firstRow = grid.find((r) => r.some(Boolean)) ?? [];
    const first = str(firstRow[0]);
    const looksLikeItemNo = first === "" || /^[0-9]+(\.[0-9]+)*\.?$|^[A-Za-z]\.?$/.test(first);
    const rows = parseRows(grid, looksLikeItemNo ? DEFAULT_COLS : DEFAULT_COLS_NO_ITEMNO);
    return rows.length ? [{ title: "", rows }] : [];
  }

  const sections: ImportedSection[] = [];

  headers.forEach((h, k) => {
    const hasNext = k + 1 < headers.length;
    const nextIdx = hasNext ? headers[k + 1].idx : grid.length;
    // The next section's title bar sits right above its header — don't read it as an item
    const end = hasNext && readTitle(grid, nextIdx) ? nextIdx - 1 : nextIdx;

    sections.push({
      title: readTitle(grid, h.idx),
      rows: parseRows(grid.slice(h.idx + 1, end), h.cols),
    });
  });

  return sections.filter((s) => s.title || s.rows.length > 0);
}

/**
 * Read an Excel/CSV file and return a 2D array of strings.
 * Uses the first sheet that contains a BOQ header row.
 */
export async function readBoqFile(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const grids = workbook.SheetNames.map((name) => {
    const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: true, // real numbers (69, 1966.6667), not formatted text
      defval: "", // keep empty cells so columns stay aligned
      blankrows: true, // keep row positions
    });
    return data.map((r) => Array.from(r, str));
  });

  return grids.find((g) => g.some((row) => detectHeader(row))) ?? grids[0] ?? [];
}

/**
 * Parse tab-separated values (clipboard paste from Excel).
 * Handles quoted cells (descriptions with line breaks) and keeps empty leading cells.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Convert imported sections to the component's BoqSection format.
 */
export function convertToBoqSections(imported: ImportedSection[]): BoqSection[] {
  const uid = () => Math.random().toString(36).slice(2, 10);

  return imported.map((section) => ({
    id: uid(),
    title: section.title,
    rows: section.rows.length
      ? section.rows.map((row) => ({ id: uid(), ...row }))
      : [{ id: uid(), description: "", qty: "", unit: "", materialCost: "", laborCost: "", consumableCost: "" }],
  }));
}