export type DepositMethod = "CC" | "Check" | "Zelle" | "Cash" | "Other";

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
  depositMethod: DepositMethod | "";
  createdAt?: string;
  updatedAt?: string;
}
