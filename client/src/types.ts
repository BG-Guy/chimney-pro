import { todayISO } from "./dateUtils";
import type { ComponentType } from "react";
import {
  BanIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  DollarSignIcon,
  FileTextIcon,
  WalletIcon,
  ReceiptIcon,
  ZapIcon,
  CircleDotIcon,
} from "./components/icons";

type Icon = ComponentType<{ size?: number }>;

export type DepositMethod = "CC" | "Check" | "Zelle" | "Cash" | "Other" | "";
export type JobStatus = "awaiting" | "done";
export type LeadOutcome = "estimate" | "deposit" | "no_estimate";

export interface JobItem {
  id?: number;
  description: string;
  cost: number;
  quantity: number;
}

export interface Payment {
  id?: number;
  amount: number;
  method: DepositMethod;
  date: string | null;
}

// A part bought for the job, stamped with the day it was added.
export interface JobPart {
  description: string;
  cost: number;
  date: string;
}

export interface Job {
  id?: number;
  rawTicketText: string;
  loggedDate: string;
  items: JobItem[];
  parts: JobPart[];
  // Always the sum of `parts` — kept as its own field so every report and calculation that
  // reads the parts cost keeps working unchanged.
  partsCost: number;
  scheduledDate: string | null;
  scheduledTimeRange: string;
  needsRepairTeam: boolean;
  payments: Payment[];
  status: JobStatus;
  completedDate: string | null;
  leadOutcome: LeadOutcome;
  tagIds: number[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEPOSIT_METHODS: DepositMethod[] = ["CC", "Check", "Zelle", "Cash", "Other"];

export const DEPOSIT_METHOD_ICON: Record<Exclude<DepositMethod, "">, Icon> = {
  CC: CreditCardIcon,
  Check: ReceiptIcon,
  Zelle: ZapIcon,
  Cash: DollarSignIcon,
  Other: CircleDotIcon,
};

export const STATUS_ICON: Record<JobStatus, Icon> = {
  awaiting: ClockIcon,
  done: CheckCircleIcon,
};

export const LEAD_OUTCOME_ICON: Record<LeadOutcome, Icon> = {
  estimate: FileTextIcon,
  deposit: WalletIcon,
  no_estimate: BanIcon,
};

export const LEAD_OUTCOME_LABEL: Record<LeadOutcome, string> = {
  estimate: "Left estimate",
  deposit: "Got deposit",
  no_estimate: "No estimate",
};

export function emptyJob(): Job {
  return {
    rawTicketText: "",
    loggedDate: todayISO(),
    items: [{ description: "", cost: 0, quantity: 1 }],
    parts: [],
    partsCost: 0,
    scheduledDate: null,
    scheduledTimeRange: "",
    needsRepairTeam: false,
    payments: [],
    status: "awaiting",
    completedDate: null,
    leadOutcome: "estimate",
    tagIds: [],
  };
}

export function itemsTotal(job: Job): number {
  return job.items.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 1), 0);
}

export function partsTotal(parts: JobPart[]): number {
  return parts.reduce((sum, part) => sum + (Number(part.cost) || 0), 0);
}

// Rounds to the cent, half up, the way the company's report does (154.215 -> 154.22), without
// floating-point noise like 154.21499999 rounding the wrong way.
export function roundCents(n: number): number {
  return Math.round(Number((n * 100).toFixed(6))) / 100;
}

// Paying by credit card adds a 3% card fee on top of the payment. The fee is its own number:
// it's part of what the customer paid, but never part of what they paid toward the job, so
// it can't eat into the balance. Paying $299 by card toward a $600 job = $307.97 paid
// ($299 + $8.97 fee), balance $301.
export const CC_FEE_RATE = 0.03;

export function paymentCardFee(p: Payment): number {
  return p.method === "CC" ? roundCents((Number(p.amount) || 0) * CC_FEE_RATE) : 0;
}

export function totalCardFee(job: Job): number {
  return roundCents(job.payments.reduce((sum, p) => sum + paymentCardFee(p), 0));
}

// What the payments cover of the job's price — the only number the balance uses.
export function paidTowardJob(job: Job): number {
  return roundCents(job.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
}

// Everything the customer paid, card fees included.
export function totalPaid(job: Job): number {
  return roundCents(paidTowardJob(job) + totalCardFee(job));
}

// A job is sold the day the customer first pays (a deposit or the full amount), not the
// day it was entered. Null while it's still just an estimate with no payment.
export function soldDate(job: Job): string | null {
  const dates = job.payments
    .filter((p) => (Number(p.amount) || 0) > 0 && p.date)
    .map((p) => p.date as string)
    .sort();
  return dates[0] ?? null;
}

// The job total is just the items total — what the customer owes. Parts cost is an internal
// cost that only eats into the tech's profit split below.
export function jobTotal(job: Job): number {
  return roundCents(itemsTotal(job));
}

export function balanceRemaining(job: Job): number {
  return roundCents(jobTotal(job) - paidTowardJob(job));
}

// Tech profit is 25% of the job total, with parts cost deducted first.
export const TECH_PROFIT_RATE = 0.25;

export function techProfit(job: Job): number {
  return roundCents((jobTotal(job) - (Number(job.partsCost) || 0)) * TECH_PROFIT_RATE);
}

// A job's tech profit only actually goes out in payroll once the work is done AND the
// customer has paid in full — not just marked done, and not just paid while still open.
export function isReadyForPayroll(job: Job): boolean {
  return job.status === "done" && balanceRemaining(job) <= 0;
}

// Walks payments in date order and finds the one whose running total first clears the
// balance — that's the real-world date the job became fully paid, which may not be the
// date someone happens to save the job. Falls back to today for any payment still missing
// a date (only possible on an in-progress, unsaved form).
export function paymentDateClearingBalance(job: Job): string | null {
  const total = jobTotal(job);
  if (total <= 0) return null;
  const sorted = job.payments
    .filter((p) => (Number(p.amount) || 0) > 0)
    .map((p) => ({ amount: Number(p.amount) || 0, date: p.date || todayISO() }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let cumulative = 0;
  for (const p of sorted) {
    cumulative += p.amount;
    if (roundCents(cumulative) >= total) return p.date;
  }
  return null;
}

// When the customer pays cash, the tech physically holds that cash and owes the company
// everything except their standard profit cut on it.
export function cashOwedToCompany(job: Job): number {
  return job.payments
    .filter((p) => p.method === "Cash")
    .reduce((sum, p) => sum + (Number(p.amount) || 0) * (1 - TECH_PROFIT_RATE), 0);
}

export function totalCashCollected(job: Job): number {
  return job.payments.reduce((sum, p) => sum + (p.method === "Cash" ? Number(p.amount) || 0 : 0), 0);
}

export interface GasLog {
  id?: number;
  amount: number;
  date: string;
  createdAt?: string;
}

export interface Tag {
  id?: number;
  name: string;
  color: TagColor;
}

// Keys into the --series-* CSS custom properties (see index.css), so tag colors adapt
// automatically between light and dark mode instead of being fixed hex values.
export type TagColor = "series-1" | "series-2" | "series-3" | "series-4" | "series-5" | "series-6" | "series-7" | "series-8";

export const TAG_COLORS: { key: TagColor; name: string }[] = [
  { key: "series-1", name: "Blue" },
  { key: "series-2", name: "Orange" },
  { key: "series-3", name: "Aqua" },
  { key: "series-4", name: "Yellow" },
  { key: "series-5", name: "Magenta" },
  { key: "series-6", name: "Green" },
  { key: "series-7", name: "Violet" },
  { key: "series-8", name: "Red" },
];
