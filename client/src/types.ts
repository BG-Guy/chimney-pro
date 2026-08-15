import { todayISO } from "./dateUtils";

export type DepositMethod = "CC" | "Check" | "Zelle" | "Cash" | "Other" | "";
export type JobStatus = "awaiting" | "done";
export type LeadOutcome = "estimate" | "deposit" | "no_estimate";

export interface JobItem {
  id?: number;
  description: string;
  cost: number;
}

export interface Job {
  id?: number;
  rawTicketText: string;
  loggedDate: string;
  items: JobItem[];
  partsCost: number;
  scheduledDate: string | null;
  needsRepairTeam: boolean;
  depositAmount: number;
  depositMethod: DepositMethod;
  depositDate: string | null;
  status: JobStatus;
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
    depositAmount: 0,
    depositMethod: "",
    depositDate: null,
    status: "awaiting",
    leadOutcome: "estimate",
    tagIds: [],
  };
}

export function itemsTotal(job: Job): number {
  return job.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

// Credit card processing eats into the deposit, so CC-paid deposits carry a 3% surcharge.
export const CC_FEE_RATE = 0.03;

export function ccFee(job: Job): number {
  if (job.depositMethod !== "CC") return 0;
  return (Number(job.depositAmount) || 0) * CC_FEE_RATE;
}

// The job total has parts cost and the CC processing fee deducted from the items total —
// both are costs, not something the tech's profit share should be calculated on.
export function jobTotal(job: Job): number {
  return itemsTotal(job) - (Number(job.partsCost) || 0) - ccFee(job);
}

export function balanceRemaining(job: Job): number {
  return jobTotal(job) - (Number(job.depositAmount) || 0);
}

// Tech profit is 25% of the job total (which already has parts cost and the CC fee deducted).
export const TECH_PROFIT_RATE = 0.25;

export function techProfit(job: Job): number {
  return jobTotal(job) * TECH_PROFIT_RATE;
}

// When the customer pays cash, the tech physically holds the money and owes the company
// everything except their own profit cut.
export function cashOwedToCompany(job: Job): number {
  if (job.depositMethod !== "Cash") return 0;
  return jobTotal(job) - techProfit(job);
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
