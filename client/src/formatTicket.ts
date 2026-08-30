import type { Job } from "./types";

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

// "2026-03-09" -> "3/09", matching how a tech would jot the date down by hand.
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${d}`;
}

export function formatTicketText(job: Job): string {
  const lines: string[] = [];

  if (job.rawTicketText.trim()) {
    lines.push(job.rawTicketText.trim());
  }

  for (const item of job.items) {
    if (!item.description.trim() && !item.cost) continue;
    const qty = item.quantity || 1;
    lines.push(qty > 1 ? `${item.description} ${qty}x` : item.description);
  }

  job.payments
    .filter((p) => p.amount > 0)
    .forEach((p, i) => {
      lines.push(`payment ${i + 1}: ${money(p.amount)}${p.method ? ` by ${p.method.toLowerCase()}` : ""}`);
    });

  if (job.status === "done") {
    lines.push("job is done");
  } else if (job.scheduledDate) {
    lines.push(`will do the job on ${shortDate(job.scheduledDate)}`);
  } else {
    lines.push("awaiting — no date scheduled yet");
  }

  return lines.join("\n");
}
