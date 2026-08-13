import { itemsTotal, jobTotal, type Job } from "./types";

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

export function formatTicketText(job: Job): string {
  const lines: string[] = [];

  if (job.id) {
    lines.push(`Job #${job.id}`);
    lines.push("");
  }

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
  lines.push(`Deposit: ${money(job.depositAmount)}${job.depositMethod ? ` (${job.depositMethod})` : ""}`);
  if (job.depositDate) lines.push(`Deposit date: ${job.depositDate}`);

  return lines.join("\n");
}
