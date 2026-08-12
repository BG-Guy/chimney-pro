export type DepositMethod = "CC" | "Check" | "Zelle" | "Cash" | "Other" | "";

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
  createdAt?: string;
  updatedAt?: string;
}

export const DEPOSIT_METHODS: DepositMethod[] = ["CC", "Check", "Zelle", "Cash", "Other"];

export function emptyJob(): Job {
  return {
    rawTicketText: "",
    items: [{ description: "", cost: 0 }],
    partsCost: 0,
    scheduledDate: null,
    needsRepairTeam: false,
    depositAmount: 0,
    depositMethod: "",
  };
}

export function itemsTotal(job: Job): number {
  return job.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

export function jobTotal(job: Job): number {
  return itemsTotal(job) + (Number(job.partsCost) || 0);
}
