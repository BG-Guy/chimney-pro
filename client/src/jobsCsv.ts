import { balanceRemaining, jobTotal, techProfit, totalCashCollected, totalPaid, type Job } from "./types";
import { extractCustomerName } from "./customerName";

interface JobRow {
  id: number;
  customerName: string | null;
  status: string;
  total: number;
  partsCost: number;
  techProfit: number;
  paid: number;
  paidMethods: string;
  cash: number;
  balance: number;
}

function toRow(j: Job): JobRow {
  return {
    id: j.id!,
    customerName: extractCustomerName(j.rawTicketText),
    status: j.status,
    total: jobTotal(j),
    partsCost: Number(j.partsCost) || 0,
    techProfit: techProfit(j),
    paid: totalPaid(j),
    paidMethods: Array.from(
      new Set(j.payments.filter((p) => p.amount && p.method).map((p) => p.method))
    ).join(", "),
    cash: totalCashCollected(j),
    balance: balanceRemaining(j),
  };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function jobsToCsv(jobs: Job[]): string {
  const rows = jobs.map(toRow);
  const header = ["Job ID", "Customer", "Status", "Total", "Parts", "Tech Profit", "Paid", "Paid By", "Cash", "Balance"];
  const body = rows.map((r) => [
    String(r.id),
    r.customerName ?? "",
    r.status,
    r.total.toFixed(2),
    r.partsCost.toFixed(2),
    r.techProfit.toFixed(2),
    r.paid.toFixed(2),
    r.paidMethods,
    r.cash.toFixed(2),
    r.balance.toFixed(2),
  ]);
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      partsCost: acc.partsCost + r.partsCost,
      techProfit: acc.techProfit + r.techProfit,
      paid: acc.paid + r.paid,
      cash: acc.cash + r.cash,
      balance: acc.balance + r.balance,
    }),
    { total: 0, partsCost: 0, techProfit: 0, paid: 0, cash: 0, balance: 0 }
  );
  const totalsRow = [
    "Totals",
    "",
    "",
    totals.total.toFixed(2),
    totals.partsCost.toFixed(2),
    totals.techProfit.toFixed(2),
    totals.paid.toFixed(2),
    "",
    totals.cash.toFixed(2),
    totals.balance.toFixed(2),
  ];
  return [header, ...body, [], totalsRow].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function totalCashInJobs(jobs: Job[]): number {
  return jobs.reduce((sum, j) => sum + totalCashCollected(j), 0);
}

export function downloadJobsCsv(jobs: Job[], filename: string) {
  const csv = jobsToCsv(jobs);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
