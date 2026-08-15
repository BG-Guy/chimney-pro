import { itemsTotal, jobTotal, type Job } from "./types";

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
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
    lines.push(`  - ${item.description || "(no description)"}: ${money(item.cost)}`);
  }
  lines.push(`Items subtotal: ${money(itemsTotal(job))}`);
  lines.push(`Parts cost: ${money(job.partsCost)}`);
  lines.push(`Total: ${money(jobTotal(job))}`);
  lines.push("");
  lines.push(`Status: ${job.status === "done" ? "Job done" : "Job awaits"}`);
  lines.push(`${job.status === "done" ? "Completed" : "Scheduled"} date: ${job.scheduledDate || "TBD"}`);
  lines.push(`Repair team needed: ${job.needsRepairTeam ? "Yes" : "No"}`);
  lines.push("");
  lines.push(`Paid: ${money(job.paidAmount)}${job.paidMethod ? ` (${job.paidMethod})` : ""}`);
  if (job.paidDate) lines.push(`Paid date: ${job.paidDate}`);

  return lines.join("\n");
}
