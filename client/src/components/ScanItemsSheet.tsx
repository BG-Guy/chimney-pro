import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import { CheckCircleIcon, ClipboardIcon, ImageIcon } from "./icons";
import { parseScannedItems, readTextFromImage, type ScannedItem } from "../itemScan";
import { formatMoney } from "../format";

type Phase = "pick" | "reading" | "results" | "error";

interface Row extends ScannedItem {
  keep: boolean;
}

// Pick (or paste) a screenshot of the job from the CRM, read its line items, let the user
// fix anything the reader got wrong, then hand the kept items back to the job form.
export default function ScanItemsSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ScannedItem[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState({ percent: 0, stage: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [rawText, setRawText] = useState("");
  const [showText, setShowText] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("pick");
    setRows([]);
    setShowText(false);
  }, [open]);

  async function scan(image: Blob) {
    setPhase("reading");
    setProgress({ percent: 0, stage: "Getting the reader ready" });
    try {
      const text = await readTextFromImage(image, (percent, stage) => setProgress({ percent, stage }));
      const result = parseScannedItems(text);
      setRawText(text);
      setTotal(result.total);
      setRows(result.items.map((item) => ({ ...item, keep: true })));
      setPhase("results");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function pasteScreenshot() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          await scan(await item.getType(type));
          return;
        }
      }
      alert("There's no screenshot on the clipboard. Copy one first, or choose it from Photos.");
    } catch {
      alert("Couldn't read the clipboard. Choose the screenshot from Photos instead.");
    }
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleAdd() {
    onAdd(
      rows
        .filter((r) => r.keep && r.description.trim())
        .map((r) => ({ description: r.description.trim(), quantity: Math.max(1, r.quantity || 1), cost: r.cost || 0 }))
    );
    onClose();
  }

  const kept = rows.filter((r) => r.keep);
  const keptSum = kept.reduce((sum, r) => sum + (r.cost || 0) * Math.max(1, r.quantity || 1), 0);
  const matchesTotal = total !== null && Math.abs(keptSum - total) < 0.01;

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Scan items from a screenshot">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) scan(file);
        }}
      />

      {phase === "pick" && (
        <>
          <h3 className="sheet-title">Scan items</h3>
          <p className="empty-hint">
            Pick a screenshot of the job from the CRM — the app finds each item and its price. The screenshot is read on
            your phone and never uploaded.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={18} /> Choose screenshot
          </button>
          <button type="button" className="btn btn-tinted btn-block" onClick={pasteScreenshot}>
            <ClipboardIcon size={18} /> Paste a copied screenshot
          </button>
        </>
      )}

      {phase === "reading" && (
        <div className="scan-reading" role="status">
          <h3 className="sheet-title">Reading the screenshot…</h3>
          <div className="scan-progress" aria-hidden="true">
            <span style={{ width: `${Math.max(4, progress.percent)}%` }} />
          </div>
          <p className="empty-hint">
            {progress.stage}
            {progress.percent > 0 ? ` · ${progress.percent}%` : ""}
          </p>
          <p className="empty-hint">The first scan downloads the reader (a few MB). After that it's quicker.</p>
        </div>
      )}

      {phase === "error" && (
        <>
          <h3 className="sheet-title">Couldn't read that screenshot</h3>
          <p className="empty-hint">({error})</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setPhase("pick")}>
            Try again
          </button>
        </>
      )}

      {phase === "results" && (
        <>
          <h3 className="sheet-title">
            {rows.length === 0 ? "No items found" : `Found ${rows.length} item${rows.length === 1 ? "" : "s"}`}
          </h3>
          {rows.length === 0 ? (
            <p className="empty-hint">
              Couldn't find any items with prices in that screenshot. Try one that shows the items list up close.
            </p>
          ) : (
            <>
              <p className="empty-hint">Check each one — tap the circle to leave an item out.</p>
              <div className="group-card">
                {rows.map((row, i) => (
                  <div className={`scan-row${row.keep ? "" : " off"}`} key={i}>
                    <button
                      type="button"
                      className={`scan-check${row.keep ? " on" : ""}`}
                      aria-pressed={row.keep}
                      aria-label={row.keep ? `Leave out ${row.description}` : `Add ${row.description}`}
                      onClick={() => updateRow(i, { keep: !row.keep })}
                    >
                      {row.keep ? <CheckCircleIcon size={24} /> : <span className="scan-check-empty" />}
                    </button>
                    <div className="scan-fields">
                      <input
                        type="text"
                        className="scan-name"
                        aria-label={`Item ${i + 1} name`}
                        value={row.description}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                      <div className="scan-line2">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="scan-qty"
                          aria-label={`Item ${i + 1} quantity`}
                          value={row.quantity || ""}
                          onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })}
                        />
                        <span className="scan-times">×</span>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          className="scan-price"
                          aria-label={`Item ${i + 1} price each`}
                          value={row.cost || ""}
                          onChange={(e) => updateRow(i, { cost: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="group-footer">
                {kept.length} item{kept.length === 1 ? "" : "s"} add up to <strong>{formatMoney(keptSum)}</strong>
                {total !== null &&
                  !matchesTotal &&
                  ` — the screenshot's total is ${formatMoney(total)}, so check the prices.`}
              </p>
              {matchesTotal && (
                <p className="scan-match">
                  <CheckCircleIcon size={16} /> Matches the CRM total
                </p>
              )}
              <button type="button" className="btn btn-primary btn-block" disabled={kept.length === 0} onClick={handleAdd}>
                Add {kept.length} item{kept.length === 1 ? "" : "s"} to the job
              </button>
            </>
          )}
          <button type="button" className="btn btn-plain" onClick={() => setPhase("pick")}>
            Scan a different screenshot
          </button>
          {rawText.trim() && (
            <>
              <button type="button" className="btn btn-plain btn-sm" onClick={() => setShowText((v) => !v)}>
                {showText ? "Hide the text it read" : "Show the text it read"}
              </button>
              {showText && <pre className="ticket-text">{rawText.trim()}</pre>}
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}
