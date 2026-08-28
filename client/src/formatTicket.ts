import { itemsTotal, jobTotal, totalPaid, type Job } from "./types";

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

export function formatTicketText(job: Job): string {
  const lines: string[] = [];

  if (job.rawTicketText.trim()) {
    lines.push(job.rawTicketText.trim());
    lines.push("");
  }

  const tags: string[] = [];
  if (job.leadOutcome === "deposit") tags.push("DEPOSIT");
  if (job.needsRepairTeam) tags.push("REPAIR TEAM");
  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
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
  lines.push(
    job.status === "done"
      ? `Completed date: ${job.completedDate || "—"}`
      : `Scheduled date: ${job.scheduledDate || "TBD"}`
  );
  lines.push(`Repair team needed: ${job.needsRepairTeam ? "Yes" : "No"}`);
  lines.push("");
  lines.push(`Paid total: ${money(totalPaid(job))}`);
  for (const p of job.payments) {
    if (!p.amount) continue;
    lines.push(`  - ${money(p.amount)}${p.method ? ` (${p.method})` : ""}`);
  }

  return lines.join("\n");
}
