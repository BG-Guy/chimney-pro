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
  items: JobItem[];
  partsCost: number;
  scheduledDate: string | null;
  needsRepairTeam: boolean;
  depositAmount: number;
  depositMethod: DepositMethod;
  depositDate: string | null;
  status: JobStatus;
  leadOutcome: LeadOutcome;
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
    items: [{ description: "", cost: 0 }],
    partsCost: 0,
    scheduledDate: null,
    needsRepairTeam: false,
    depositAmount: 0,
    depositMethod: "",
    depositDate: null,
    status: "awaiting",
    leadOutcome: "estimate",
  };
}

export function itemsTotal(job: Job): number {
  return job.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

// The job total has the parts cost deducted from the items total (parts are a cost, not
// something billed on top).
export function jobTotal(job: Job): number {
  return itemsTotal(job) - (Number(job.partsCost) || 0);
}

export function balanceRemaining(job: Job): number {
  return jobTotal(job) - (Number(job.depositAmount) || 0);
}

// Tech profit is 25% of the job total (which already has parts cost deducted).
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
