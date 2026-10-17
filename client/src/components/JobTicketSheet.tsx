import { useState } from "react";
import { Link } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import { ClipboardIcon, MapPinIcon } from "./icons";
import { formatTicketText } from "../formatTicket";
import { extractAddress } from "../address";
import { extractCustomerName } from "../customerName";
import { extractTicketNumber } from "../ticketNumber";
import { navigationUrl } from "../navigation";
import type { Job } from "../types";

// The full job ticket for one job: the original pasted ticket and the app's summary.
export default function JobTicketSheet({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const [shown, setShown] = useState<Job | null>(job);
  const [copied, setCopied] = useState<string | null>(null);
  // Keep showing the last job while the sheet slides down.
  if (job && job !== shown) setShown(job);
  const current = job ?? shown;

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  const address = current ? extractAddress(current.rawTicketText) : null;
  const ticketNumber = current ? extractTicketNumber(current.rawTicketText) : null;

  return (
    <BottomSheet open={!!job} onClose={onClose} ariaLabel="Job ticket">
      {current && (
        <>
          <div className="cmp-header">
            <h3>{extractCustomerName(current.rawTicketText) ?? "Job ticket"}</h3>
            <span className="empty-hint">{ticketNumber ? `#${ticketNumber}` : `Job ${current.id}`}</span>
          </div>

          {address && (
            <a className="btn btn-primary btn-block" href={navigationUrl(address)} target="_blank" rel="noreferrer">
              <MapPinIcon size={16} /> Navigate to {address}
            </a>
          )}

          <div className="ticket-block">
            <div className="ticket-block-head">
              <h4>Original ticket</h4>
              <button type="button" className="btn btn-sm" onClick={() => copy(current.rawTicketText, "orig")}>
                <ClipboardIcon size={14} /> {copied === "orig" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="ticket-text">{current.rawTicketText.trim() || "No ticket pasted."}</pre>
          </div>

          <div className="ticket-block">
            <div className="ticket-block-head">
              <h4>Ticket summary</h4>
              <button type="button" className="btn btn-sm" onClick={() => copy(formatTicketText(current), "gen")}>
                <ClipboardIcon size={14} /> {copied === "gen" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="ticket-text">{formatTicketText(current)}</pre>
          </div>

          <div className="form-actions">
            <Link to={`/jobs/${current.id}/edit`} className="btn">
              Edit job
            </Link>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
