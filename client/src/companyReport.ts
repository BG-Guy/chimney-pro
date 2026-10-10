// Reads the company's weekly "Finance Report" PDF (Workiz) into structured rows so it can
// be checked against the app's own paycheck numbers.

export interface CompanyReportJob {
  jobId: string;
  closedDate: string | null;
  jobType: string;
  client: string;
  total: number;
  cash: number;
  credit: number;
  billing: number;
  check: number;
  tip: number;
  parts: number;
  companyParts: number;
  techProfit: number;
  balanceTech: number;
}

export interface CompanyReport {
  startISO: string | null;
  endISO: string | null;
  jobs: CompanyReportJob[];
}

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

const JOB_ID_RE = /^\d{8,10}$/;
const NUMBER_RE = /^-?\$?[\d,]+(\.\d+)?$/;
const PERCENT_RE = /^\d+(\.\d+)?%$/;
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/;

function toISO(s: string): string | null {
  const m = s.match(DATE_RE);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[1]}-${m[2]}`;
}

function toNumber(s: string): number {
  return Number(s.replace(/[$,]/g, "")) || 0;
}

interface Columns {
  jobType: number;
  address: number;
  client: number;
}

// Column starts come from the header labels; cells sit a few points left of their label.
function findColumns(items: TextItem[]): Columns | null {
  const at = (label: string) => items.find((i) => i.str.trim() === label)?.x;
  const jobType = at("Type");
  const address = at("Address");
  const client = at("Client");
  if (jobType === undefined || address === undefined || client === undefined) return null;
  return { jobType: jobType - 8, address: address - 8, client: client - 8 };
}

// Every single-line cell in a row (the numbers, the job id) shares the job id's baseline,
// so a row is read off that one line. The "25%" tech-share cell splits it cleanly: the five
// numbers before it are Total/Cash/Credit/Billing/Check, the six after are Tip/Parts/
// Company Parts/Tech Profit/Balance Tech/Tax. Wrapped text (job type, client name) spans
// a couple of lines around the baseline, so it's read from a slightly taller band.
export function parseCompanyReport(pages: TextItem[][]): CompanyReport {
  const allText = pages.flat().map((i) => i.str).join(" ");
  const period = allText.match(/From\s+(\d{2}\/\d{2}\/\d{2,4})\s+to\s+(\d{2}\/\d{2}\/\d{2,4})/);

  const jobs: CompanyReportJob[] = [];
  let columns: Columns | null = null;

  for (const items of pages) {
    columns = findColumns(items) ?? columns;

    for (const id of items.filter((i) => JOB_ID_RE.test(i.str.trim()))) {
      const tokens = items
        .filter((i) => Math.abs(i.y - id.y) <= 3)
        .sort((a, b) => a.x - b.x)
        .flatMap((i) => i.str.split(/\s+/).filter(Boolean));

      const pct = tokens.findIndex((t) => PERCENT_RE.test(t));
      if (pct === -1) continue;
      const before = tokens.slice(0, pct).filter((t) => NUMBER_RE.test(t)).slice(-5).map(toNumber);
      const after = tokens.slice(pct + 1).filter((t) => NUMBER_RE.test(t)).slice(0, 6).map(toNumber);
      if (before.length < 5 || after.length < 5) continue;

      const band = items.filter((i) => Math.abs(i.y - id.y) <= 9);
      // Created / Scheduled / Closed, left to right — each is a date line over a time line.
      const dates = [...band]
        .sort((a, b) => a.x - b.x || b.y - a.y)
        .map((i) => toISO(i.str.trim()))
        .filter((d): d is string => d !== null);
      const textIn = (from: number, to: number) =>
        band
          .filter((i) => i.x >= from && i.x < to)
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .map((i) => i.str.trim())
          .join(" ")
          .trim();

      const [total, cash, credit, billing, check] = before;
      const [tip, parts, companyParts, techProfit, balanceTech] = after;
      jobs.push({
        jobId: id.str.trim(),
        closedDate: dates[2] ?? dates[dates.length - 1] ?? null,
        jobType: columns ? textIn(columns.jobType, columns.address) : "",
        client: columns ? textIn(columns.client, Infinity) : "",
        total,
        cash,
        credit,
        billing,
        check,
        tip,
        parts,
        companyParts,
        techProfit,
        balanceTech,
      });
    }
  }

  return {
    startISO: period ? toISO(period[1]) : null,
    endISO: period ? toISO(period[2]) : null,
    jobs,
  };
}

let pdfWorker: Worker | null = null;

// pdf.js is big, so it's only loaded the moment a report is actually opened.
export async function readCompanyReportPdf(file: File): Promise<CompanyReport> {
  // iPhone Safari needs two things pdf.js assumes: the legacy build (the default one calls
  // brand-new JavaScript like Promise.try that Safari lacks), and streams that can be looped
  // with `for await` — added by streamIterator here and inside our own worker.
  await import("./streamIterator");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfWorker ??= new Worker(new URL("./pdfWorker.ts", import.meta.url), { type: "module" });
  pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: TextItem[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(
        content.items
          .filter((i): i is typeof i & { str: string; transform: number[] } => "str" in i && i.str.trim() !== "")
          .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))
      );
    }
    return parseCompanyReport(pages);
  } finally {
    await task.destroy();
  }
}
