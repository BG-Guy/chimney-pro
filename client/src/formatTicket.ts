import { jobTotal, type Job } from "./types";

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
    lines.push("");
  }

  lines.push("Items:");
  for (const item of job.items) {
    if (!item.description.trim() && !item.cost) continue;
    const qty = item.quantity || 1;
    const qtyLabel = qty > 1 ? ` x${qty}` : "";
    const lineTotal = qty > 1 ? ` = ${money(item.cost * qty)}` : "";
    lines.push(`  - ${item.description || "(no description)"}${qtyLabel}: ${money(item.cost)}${lineTotal}`);
  }
  lines.push(`Total price: ${money(jobTotal(job))}`);

  const tags: string[] = [];
  if (job.leadOutcome === "deposit") tags.push("DEPOSIT");
  if (job.needsRepairTeam) tags.push("REPAIR TEAM");
  if (tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${tags.join(", ")}`);
  }

  const paidPayments = job.payments.filter((p) => p.amount > 0);
  if (paidPayments.length > 0) {
    lines.push("");
    paidPayments.forEach((p, i) => {
      lines.push(`Payment ${i + 1}: ${money(p.amount)}${p.method ? ` by ${p.method.toLowerCase()}` : ""}`);
    });
  }

  lines.push("");
  if (job.status === "done") {
    lines.push("Job is done.");
  } else if (job.scheduledDate) {
    lines.push(`Will do the job on ${shortDate(job.scheduledDate)}.`);
  } else {
    lines.push("Awaiting — no date scheduled yet.");
  }

  return lines.join("\n");
}
