// Reads a job's line items (name, quantity, price) out of a CRM screenshot.
// The text is read on the phone itself with Tesseract (free, nothing is uploaded); the
// parsing below is plain text rules, so it also works on text pasted from iOS Live Text.

export interface ScannedItem {
  description: string;
  quantity: number;
  cost: number;
}

export interface ScanResult {
  items: ScannedItem[];
  // The screenshot's own "Total", when it shows one — used to double-check the items.
  total: number | null;
}

// "$149.00", "$ 1,250", or a bare "149.00" (two decimals, so zip codes and quantities don't count).
const MONEY_RE = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)|\b(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})\b/g;

// Lines that are about the whole job, not one item.
const SUMMARY_RE =
  /^(sub\s*-?\s*total|grand\s+total|total|tax(es)?|sales\s+tax|discount|balance(\s+due)?|amount\s+due|due|paid|payments?|tips?|deposits?|credit|change|fees?)\b/i;

// Column headings and section titles that sit above the items.
const HEADER_RE =
  /^(items?|line\s+items?|products?(\s*(&|and)\s*services)?|services|description|qty|quantity|price|amount|rate|unit\s+price|total)$/i;

// Words that describe a price column, not an item.
const COLUMN_WORDS_RE = /\b(qty|quantity|price|unit|rate|amount|cost|each|ea|per)\b/gi;

const QTY_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*[x×✕]\s*(?=\$|\d)/i, // "2 x $50.00", "1×149.00"
  /\b(?:qty|quantity)\s*[:.]?\s*(\d+(?:\.\d+)?)/i, // "Qty: 2"
  /(?:^|\s)[x×✕]\s*(\d+)\b/i, // "x2"
];

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

// Common OCR slips on money: "S149.00" or "§149.00" for "$149.00".
function normalize(line: string): string {
  return line.replace(/(^|[\s(])[S§]\s?(?=\d)/g, "$1$").replace(/\s+/g, " ").trim();
}

function findQty(line: string): number | null {
  for (const re of QTY_PATTERNS) {
    const m = line.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && n < 1000) return n;
    }
  }
  return null;
}

// The text of a line once prices, quantities and column words are taken out.
function labelOf(line: string): string {
  let label = line.replace(MONEY_RE, " ");
  for (const re of QTY_PATTERNS) label = label.replace(re, " ");
  return label
    .replace(/^[\s\-–—•·|:=@*]+|[\s\-–—•·|:=@*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWords(label: string): boolean {
  const words = label.replace(COLUMN_WORDS_RE, " ").replace(/[^a-z]/gi, "");
  return words.length >= 3;
}

export function parseScannedItems(text: string): ScanResult {
  const lines = text
    .split(/\r?\n/)
    .map(normalize)
    .filter(Boolean);

  const items: ScannedItem[] = [];
  let total: number | null = null;
  // Text lines seen since the last item — the first is usually the item's name, the rest
  // its description.
  let pending: string[] = [];
  let pendingQty: number | null = null;

  for (const line of lines) {
    const amounts = [...line.matchAll(MONEY_RE)].map((m) => toNumber(m[1] ?? m[2]));
    let label = labelOf(line);
    let columnQty: number | null = null;
    // A "Qty | Price | Amount" row: the number just before the prices is the quantity, but only
    // when quantity × price really equals the amount — so "Level 2" keeps its 2.
    const trailing = amounts.length >= 2 ? label.match(/^(.*\S)\s+(\d{1,3})$/) : null;
    if (trailing && Math.abs(Number(trailing[2]) * amounts[0] - amounts[amounts.length - 1]) < 0.01) {
      label = trailing[1];
      columnQty = Number(trailing[2]);
    }

    if (amounts.length === 0) {
      const qty = findQty(line);
      if (qty !== null && !hasWords(label)) {
        pendingQty = qty;
        continue;
      }
      if (HEADER_RE.test(label) || !hasWords(label)) continue;
      pending.push(label);
      continue;
    }

    if (SUMMARY_RE.test(label)) {
      if (/^(grand\s+)?total\b/i.test(label)) total = amounts[amounts.length - 1];
      pending = [];
      pendingQty = null;
      continue;
    }

    const name = hasWords(label) ? label : pending[0] ?? "";
    if (!name) continue; // a price with nothing to call it by

    const unit = amounts[0];
    let quantity = findQty(line) ?? columnQty ?? pendingQty;
    if (quantity === null) {
      // "149.00  298.00" — a unit price and a line total imply the quantity.
      const lineTotal = amounts[amounts.length - 1];
      quantity = amounts.length >= 2 && unit > 0 ? Math.round(lineTotal / unit) || 1 : 1;
    }

    items.push({ description: name, quantity: Math.max(1, quantity), cost: unit });
    pending = [];
    pendingQty = null;
  }

  return { items, total };
}

// Screenshots are big and often in dark mode; Tesseract reads dark text on a light page
// best, so the image is turned gray, flipped when it's dark, and kept to a sane size.
async function prepareImage(image: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(image);
  const scale = bitmap.width < 900 ? 2 : bitmap.width > 2000 ? 2000 / bitmap.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = gray;
    sum += gray;
  }
  if (sum / (px.length / 4) < 110) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function readTextFromImage(
  image: Blob,
  onProgress?: (percent: number, stage: string) => void
): Promise<string> {
  const canvas = await prepareImage(image);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100), "Reading the screenshot");
      else onProgress?.(0, "Getting the reader ready");
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
