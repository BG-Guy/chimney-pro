import { balanceRemaining, jobTotal, type Job } from "./types";
import { formatMoney as money } from "./format";

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// "2026-10-09" -> "Friday October 9th", the way the tech would write it to the office.
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} ${month} ${ordinal(d)}`;
}

export function formatTicketText(job: Job): string {
  const lines: string[] = [];

  if (job.rawTicketText.trim()) {
    lines.push(job.rawTicketText.trim(), "");
  }

  lines.push(`Total ${money(jobTotal(job))}`);

  for (const p of job.payments) {
    if (!(p.amount > 0)) continue;
    lines.push(p.method ? `${money(p.amount)} ${p.method.toLowerCase()}` : money(p.amount));
  }

  if (job.status === "done") {
    lines.push("Job is done, paid in full");
    return lines.join("\n");
  }

  lines.push(`Balance ${money(balanceRemaining(job))}`);

  const who = job.needsRepairTeam ? "Repair team" : "Tech";
  if (job.scheduledDate) {
    const time = job.scheduledTimeRange.trim();
    lines.push(`${who} will do the job on ${longDate(job.scheduledDate)}${time ? ` ${time}` : ""}`);
  } else {
    lines.push(`${who} will do the job — no date scheduled yet`);
  }

  return lines.join("\n");
}
