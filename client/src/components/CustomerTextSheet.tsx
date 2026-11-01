import { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import HourWheel from "./HourWheel";
import { ClipboardIcon, CheckCircleIcon } from "./icons";
import {
  SLOT_HOURS,
  clampHour,
  customerFirstName,
  etaMessage,
  extractPhone,
  formatSlot,
  hourLabel,
  lateMessage,
  slotFromStopTime,
  smsHref,
} from "../customerMessages";

export type CustomerTextKind = "eta" | "late";

export interface CustomerTextTarget {
  kind: CustomerTextKind;
  rawText: string;
  time: string;
}

const ETA_MINUTES = [10, 15, 20, 30, 45, 60];
const DEFAULT_ETA = 30;
const MIN_ETA = 5;
const MAX_ETA = 180;

// One sheet for both customer texts the tech sends from the road: "I'll arrive in about N
// minutes" and "running late, will a later window work?". The message is ready the moment
// the sheet opens — the defaults are the common case — so most sends are a single tap.
export default function CustomerTextSheet({
  target,
  onClose,
}: {
  target: CustomerTextTarget | null;
  onClose: () => void;
}) {
  // Kept after closing so the sheet's content doesn't vanish while it slides down.
  const [shown, setShown] = useState<CustomerTextTarget | null>(target);
  const [minutes, setMinutes] = useState(DEFAULT_ETA);
  const [currentSlot, setCurrentSlot] = useState("");
  const [newStart, setNewStart] = useState(12);
  const [newEnd, setNewEnd] = useState(15);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!target) return;
    setShown(target);
    setCopied(false);
    setMinutes(DEFAULT_ETA);
    const slot = slotFromStopTime(target.time);
    if (slot) {
      setCurrentSlot(formatSlot(slot.start, slot.end));
      // Suggest the same-length window one hour later — the usual ask when running behind.
      const length = Math.max(1, slot.end - slot.start);
      const start = clampHour(slot.start + 1);
      setNewStart(start);
      setNewEnd(clampHour(start + length));
    } else {
      setCurrentSlot("");
      setNewStart(12);
      setNewEnd(15);
    }
  }, [target]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const firstName = shown ? customerFirstName(shown.rawText) : null;
  const phone = shown ? extractPhone(shown.rawText) : null;
  const newSlot = formatSlot(newStart, newEnd);
  const message =
    shown?.kind === "late"
      ? lateMessage(firstName, currentSlot.trim() || "the window we set", newSlot)
      : etaMessage(firstName, minutes);

  function changeStart(h: number) {
    setNewStart(h);
    // The window always ends after it starts; keep its length when the start moves past it.
    if (newEnd <= h) setNewEnd(clampHour(h + Math.max(1, newEnd - newStart)));
  }

  function changeEnd(h: number) {
    setNewEnd(h);
    if (h <= newStart) setNewStart(clampHour(h - 1));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Couldn't copy to the clipboard.");
    }
  }

  return (
    <BottomSheet
      open={target !== null}
      onClose={onClose}
      ariaLabel={shown?.kind === "late" ? "Running late message" : "Arrival time message"}
    >
      <h2 className="sheet-title">{shown?.kind === "late" ? "Running late" : "Send ETA"}</h2>

      {shown?.kind === "late" ? (
        <>
          <label className="text-sheet-field">
            <span className="row-label">Current window</span>
            <input
              type="text"
              className="row-input"
              value={currentSlot}
              placeholder="e.g. 11-2"
              onChange={(e) => setCurrentSlot(e.target.value)}
            />
          </label>
          <div className="text-sheet-section">
            <span className="row-label">New window</span>
            <div className="wheel-pair">
              <HourWheel values={SLOT_HOURS} value={newStart} onChange={changeStart} format={hourLabel} ariaLabel="New window start hour" />
              <span className="wheel-dash">–</span>
              <HourWheel values={SLOT_HOURS} value={newEnd} onChange={changeEnd} format={hourLabel} ariaLabel="New window end hour" />
            </div>
          </div>
        </>
      ) : (
        <div className="text-sheet-section">
          <span className="row-label">Arriving in</span>
          <div className="eta-stepper">
            <button
              type="button"
              aria-label="5 minutes less"
              disabled={minutes <= MIN_ETA}
              onClick={() => setMinutes((m) => Math.max(MIN_ETA, m - 5))}
            >
              −
            </button>
            <strong>{minutes} min</strong>
            <button
              type="button"
              aria-label="5 minutes more"
              disabled={minutes >= MAX_ETA}
              onClick={() => setMinutes((m) => Math.min(MAX_ETA, m + 5))}
            >
              +
            </button>
          </div>
          <div className="chip-scroll-row">
            {ETA_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip-pill${minutes === m ? " selected" : ""}`}
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="ticket-preview text-sheet-preview">{message}</p>

      <div className="form-actions">
        <button type="button" className="btn" onClick={handleCopy}>
          {copied ? (
            <>
              <CheckCircleIcon size={16} /> Copied!
            </>
          ) : (
            <>
              <ClipboardIcon size={16} /> Copy
            </>
          )}
        </button>
        <a className="btn btn-primary" href={smsHref(phone, message)} onClick={onClose}>
          {phone ? "Send text" : "Open Messages"}
        </a>
      </div>
      {!phone && <p className="empty-hint">No phone number found in the ticket — pick the contact in Messages.</p>}
    </BottomSheet>
  );
}
