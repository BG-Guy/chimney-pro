import { todayISO } from "./dateUtils";

export type DepositMethod = "CC" | "Check" | "Zelle" | "Cash" | "Other" | "";
export type JobStatus = "awaiting" | "done";
export type LeadOutcome = "estimate" | "deposit" | "no_estimate";

export interface JobItem {
  id?: number;
  description: string;
  cost: number;
}

export interface Payment {
  id?: number;
  amount: number;
  method: DepositMethod;
  date: string | null;
}

export interface Job {
  id?: number;
  rawTicketText: string;
  loggedDate: string;
  items: JobItem[];
  partsCost: number;
  scheduledDate: string | null;
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

export const DEPOSIT_METHOD_EMOJI: Record<Exclude<DepositMethod, "">, string> = {
  CC: "💳",
  Check: "🧾",
  Zelle: "⚡",
  Cash: "💵",
  Other: "🔘",
};

export const STATUS_EMOJI: Record<JobStatus, string> = {
  awaiting: "⏳",
  done: "✅",
};

export const LEAD_OUTCOME_EMOJI: Record<LeadOutcome, string> = {
  estimate: "📝",
  deposit: "💰",
  no_estimate: "🚫",
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
    items: [{ description: "", cost: 0 }],
    partsCost: 0,
    scheduledDate: null,
    needsRepairTeam: false,
    payments: [],
    status: "awaiting",
    completedDate: null,
    leadOutcome: "estimate",
    tagIds: [],
  };
}

export function itemsTotal(job: Job): number {
  return job.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

export function totalPaid(job: Job): number {
  return job.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

// Credit card processing eats into each CC-paid payment, so those carry a 3% surcharge.
export const CC_FEE_RATE = 0.03;

export function totalCcFee(job: Job): number {
  return job.payments.reduce(
    (sum, p) => sum + (p.method === "CC" ? (Number(p.amount) || 0) * CC_FEE_RATE : 0),
    0
  );
}

// The job total has the parts cost deducted from the items total (parts are a cost, not
// something billed on top). It's what the customer actually owes — the CC fee is not part
// of it, since that's an internal cost that only eats into the tech's profit split.
export function jobTotal(job: Job): number {
  return itemsTotal(job) - (Number(job.partsCost) || 0);
}

export function balanceRemaining(job: Job): number {
  return jobTotal(job) - totalPaid(job);
}

// Tech profit is 25% of the job total, with the CC processing fee deducted first — same
// treatment as parts cost, so the fee comes out of the shared pool, not the customer's balance.
export const TECH_PROFIT_RATE = 0.25;

export function techProfit(job: Job): number {
  return (jobTotal(job) - totalCcFee(job)) * TECH_PROFIT_RATE;
}

// When the customer pays cash, the tech physically holds that cash and owes the company
// everything except their standard profit cut on it.
export function cashOwedToCompany(job: Job): number {
  return job.payments
    .filter((p) => p.method === "Cash")
    .reduce((sum, p) => sum + (Number(p.amount) || 0) * (1 - TECH_PROFIT_RATE), 0);
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
