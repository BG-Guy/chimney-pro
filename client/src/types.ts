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

// Card payments follow the company's finance report: the customer's card is charged the
// amount plus 3.5%, and the company keeps 3.5% of that charge as the processing fee before
// the tech's split. A CC payment's `amount` is the part of the price it covers.
export const CC_FEE_RATE = 0.035;

// What the customer actually paid on this payment — card payments include the surcharge.
export function paymentCharged(p: Payment): number {
  const amount = Number(p.amount) || 0;
  return p.method === "CC" ? roundCents(amount * (1 + CC_FEE_RATE)) : amount;
}

// The 3.5% added on top of the price for everything paid by card.
export function ccSurcharge(job: Job): number {
  return roundCents(
    job.payments.reduce((sum, p) => sum + (p.method === "CC" ? paymentCharged(p) - (Number(p.amount) || 0) : 0), 0)
  );
}

export function totalPaid(job: Job): number {
  return roundCents(job.payments.reduce((sum, p) => sum + paymentCharged(p), 0));
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

// The company's processing fee: 3.5% of each card charge.
export function totalCcFee(job: Job): number {
  return roundCents(
    job.payments.reduce((sum, p) => sum + (p.method === "CC" ? roundCents(paymentCharged(p) * CC_FEE_RATE) : 0), 0)
  );
}

// The job total is what the customer pays: the items plus the card surcharge on whatever
// they paid by card — the same "Total" the company's report shows. Parts cost and the card
// fee are internal costs that only eat into the tech's profit split below.
export function jobTotal(job: Job): number {
  return roundCents(itemsTotal(job) + ccSurcharge(job));
}

// The surcharge is on both sides (in the total and in what was paid), so the balance is
// simply the price minus the part of it the payments cover.
export function balanceRemaining(job: Job): number {
  return roundCents(jobTotal(job) - totalPaid(job));
}

// Tech profit is 25% of the job total, with parts cost and the card processing fee deducted
// first — both come out of the shared pool, not the customer's balance.
export const TECH_PROFIT_RATE = 0.25;

export function techProfit(job: Job): number {
  return roundCents((jobTotal(job) - (Number(job.partsCost) || 0) - totalCcFee(job)) * TECH_PROFIT_RATE);
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
    .map((p) => ({ amount: paymentCharged(p), date: p.date || todayISO() }))
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
