import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobTotal, type Job } from "../types";
import { extractCustomerName } from "../customerName";
import { extractTicketNumber } from "../ticketNumber";
import { formatTicketText } from "../formatTicket";
import { formatMoney } from "../format";
import { fmtISO, todayISO } from "../dateUtils";
import { parseScheduledStartMinutes } from "../scheduledTime";
import { BackIcon, ClipboardIcon } from "./icons";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_DOTS = 3;

function startMinutes(job: Job): number {
  return parseScheduledStartMinutes(job.scheduledTimeRange || null) ?? Number.MAX_SAFE_INTEGER;
}

export default function JobsCalendarSheet({ jobs, onClose }: { jobs: Job[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      if (!job.scheduledDate) continue;
      const list = map.get(job.scheduledDate);
      if (list) list.push(job);
      else map.set(job.scheduledDate, [job]);
    }
    for (const list of map.values()) list.sort((a, b) => startMinutes(a) - startMinutes(b));
    return map;
  }, [jobs]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const result: (string | null)[] = Array(month.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(fmtISO(new Date(year, m, d)));
    return result;
  }, [month]);

  const monthJobCount = cells.reduce((sum, iso) => sum + (iso ? jobsByDay.get(iso)?.length ?? 0 : 0), 0);
  const today = todayISO();
  const selectedJobs = selectedDay ? jobsByDay.get(selectedDay) ?? [] : [];

  function shiftMonth(delta: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label="Scheduled jobs calendar">
        <div className="sheet-handle" />
        <div className="calendar-header">
          <button type="button" className="btn btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <BackIcon size={16} />
          </button>
          <h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
          <button type="button" className="btn btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
            <span style={{ display: "flex", transform: "rotate(180deg)" }}>
              <BackIcon size={16} />
            </span>
          </button>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="calendar-weekday">
              {w}
            </span>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span key={`blank-${i}`} />;
            const dayJobs = jobsByDay.get(iso) ?? [];
            return (
              <button
                key={iso}
                type="button"
                className={`calendar-cell${iso === today ? " today" : ""}${dayJobs.length ? " has-jobs" : ""}`}
                disabled={dayJobs.length === 0}
                onClick={() => setSelectedDay(iso)}
              >
                <span className="calendar-day-num">{Number(iso.slice(8))}</span>
                <span className="calendar-dots">
                  {dayJobs.slice(0, MAX_DOTS).map((job) => (
                    <span key={job.id} className={`calendar-dot ${job.needsRepairTeam ? "repair" : "tech"}`} />
                  ))}
                  {dayJobs.length > MAX_DOTS && <span className="calendar-more">+{dayJobs.length - MAX_DOTS}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span>
            <span className="calendar-dot tech" /> Tech
          </span>
          <span>
            <span className="calendar-dot repair" /> Repair team
          </span>
          <span style={{ marginLeft: "auto" }}>
            {monthJobCount} job{monthJobCount === 1 ? "" : "s"} this month
          </span>
        </div>

        <button type="button" className="btn btn-block" onClick={onClose}>
          Close
        </button>
      </div>

      {selectedDay && (
        <div className="day-popup-backdrop" onClick={(e) => e.target === e.currentTarget && setSelectedDay(null)}>
          <div className="day-popup" role="dialog" aria-label="Jobs on this day">
            <div className="card-header">
              <h3>
                {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button type="button" className="btn btn-sm" onClick={() => setSelectedDay(null)}>
                Close
              </button>
            </div>
            {selectedJobs.map((job) => {
              const ticketNumber = extractTicketNumber(job.rawTicketText);
              return (
                <div className="day-popup-job" key={job.id}>
                  <div className="day-popup-job-top">
                    <span className={`calendar-dot ${job.needsRepairTeam ? "repair" : "tech"}`} />
                    <strong>{extractCustomerName(job.rawTicketText) ?? "No name"}</strong>
                    <span className="job-card-total">{formatMoney(jobTotal(job))}</span>
                  </div>
                  <span className="empty-hint">
                    {ticketNumber ? `#${ticketNumber}` : "No job #"} · {job.scheduledTimeRange || "No hour set"} ·{" "}
                    {job.needsRepairTeam ? "Repair team" : "Tech"}
                  </span>
                  <div className="day-popup-actions">
                    <button type="button" className="btn btn-sm" onClick={() => copy(job.rawTicketText, `${job.id}-orig`)}>
                      <ClipboardIcon size={14} /> {copiedKey === `${job.id}-orig` ? "Copied!" : "Copy original"}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => copy(formatTicketText(job), `${job.id}-gen`)}>
                      <ClipboardIcon size={14} /> {copiedKey === `${job.id}-gen` ? "Copied!" : "Copy ticket"}
                    </button>
                    {ticketNumber && (
                      <button type="button" className="btn btn-sm" onClick={() => copy(ticketNumber, `${job.id}-num`)}>
                        {copiedKey === `${job.id}-num` ? "Copied!" : `Copy #${ticketNumber}`}
                      </button>
                    )}
                    <button type="button" className="btn btn-sm" onClick={() => navigate(`/jobs/${job.id}/edit`)}>
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
