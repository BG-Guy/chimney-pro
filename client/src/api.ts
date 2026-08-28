import { jobTotal, totalPaid, type GasLog, type Job, type JobStatus, type LeadOutcome, type Payment, type Tag } from "./types";
import { todayISO } from "./dateUtils";

const JOBS_KEY = "chimneypro:jobs";
const JOBS_SEQ_KEY = "chimneypro:jobs:seq";
const GAS_KEY = "chimneypro:gas";
const GAS_SEQ_KEY = "chimneypro:gas:seq";
const TAGS_KEY = "chimneypro:tags";
const TAGS_SEQ_KEY = "chimneypro:tags:seq";

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nextId(seqKey: string): number {
  const next = read<number>(seqKey, 0) + 1;
  write(seqKey, next);
  return next;
}

function nowISO(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// The tech gets paid out when a job is marked done, so that's the date worth tracking —
// stamp it the moment status flips to "done" (or keep a manually-edited date), and clear
// it if the job goes back to awaiting.
function resolveCompletedDate(
  prevStatus: JobStatus | undefined,
  nextStatus: JobStatus,
  prevCompletedDate: string | null,
  submittedCompletedDate: string | null = null
): string | null {
  if (nextStatus !== "done") return null;
  if (submittedCompletedDate) return submittedCompletedDate;
  if (prevStatus === "done" && prevCompletedDate) return prevCompletedDate;
  return todayISO();
}

// A payment with no date means "today, whenever this gets saved" — stamp any still-blank
// dates at save time rather than leaving them null forever.
function resolvePayments(payments: Payment[]): Payment[] {
  return payments.map((p) => ({ ...p, date: p.date || todayISO() }));
}

// The user only enters items and payments — whether a job counts as a deposit is derived
// from that, not picked manually: a balance left on the table means a deposit was taken
// and the rest of the job is still to come.
function resolveLeadOutcome(job: Job): LeadOutcome {
  const paid = totalPaid(job);
  const total = jobTotal(job);
  if (paid > 0 && paid < total) return "deposit";
  return "estimate";
}

// Job status is derived the same way: awaiting until enough has been paid to clear the
// balance, then done (and ready for the paycheck). A job with no items yet isn't "done"
// just because there's nothing to owe.
function resolveJobStatus(job: Job): JobStatus {
  const total = jobTotal(job);
  const paid = totalPaid(job);
  return total > 0 && paid >= total ? "done" : "awaiting";
}

function readJobs(): Job[] {
  // Jobs saved before a field was added won't have it in storage; backfill defaults
  // (and migrate the old single paid*/deposit* fields into a payments list) so old
  // records don't crash newer UI.
  return read<any[]>(JOBS_KEY, []).map((job): Job => {
    const legacyAmount = job.paidAmount ?? job.depositAmount ?? 0;
    const legacyMethod = job.paidMethod ?? job.depositMethod ?? "";
    const legacyDate = job.paidDate ?? job.depositDate ?? null;
    const payments: Payment[] = job.payments
      ? job.payments.map((p: any) => ({ ...p, date: p.date ?? null }))
      : legacyAmount > 0
        ? [{ amount: legacyAmount, method: legacyMethod, date: legacyDate }]
        : [];
    return {
      ...job,
      tagIds: job.tagIds ?? [],
      loggedDate: job.loggedDate ?? job.createdAt?.slice(0, 10) ?? todayISO(),
      items: (job.items ?? []).map((item: any) => ({ ...item, quantity: item.quantity ?? 1 })),
      payments,
      completedDate:
        job.completedDate ?? (job.status === "done" ? job.updatedAt?.slice(0, 10) ?? null : null),
    };
  });
}

function writeJobs(jobs: Job[]) {
  write(JOBS_KEY, jobs);
}

function readGas(): GasLog[] {
  return read<GasLog[]>(GAS_KEY, []);
}

function writeGas(logs: GasLog[]) {
  write(GAS_KEY, logs);
}

function readTags(): Tag[] {
  return read<Tag[]>(TAGS_KEY, []);
}

function writeTags(tags: Tag[]) {
  write(TAGS_KEY, tags);
}

function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    if (a.loggedDate !== b.loggedDate) return a.loggedDate < b.loggedDate ? 1 : -1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

function sortGas(logs: GasLog[]): GasLog[] {
  return [...logs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export const api = {
  async listJobs(): Promise<Job[]> {
    return sortJobs(readJobs());
  },

  async getJob(id: number): Promise<Job> {
    const job = readJobs().find((j) => j.id === id);
    if (!job) throw new Error("Job not found");
    return job;
  },

  async createJob(job: Job): Promise<Job> {
    const jobs = readJobs();
    const now = nowISO();
    const payments = resolvePayments(job.payments);
    const withPayments = { ...job, payments };
    const status = resolveJobStatus(withPayments);
    const created: Job = {
      ...withPayments,
      id: nextId(JOBS_SEQ_KEY),
      status,
      leadOutcome: resolveLeadOutcome(withPayments),
      completedDate: resolveCompletedDate(undefined, status, null, job.completedDate),
      createdAt: now,
      updatedAt: now,
    };
    jobs.push(created);
    writeJobs(jobs);
    return created;
  },

  async updateJob(id: number, job: Job): Promise<Job> {
    const jobs = readJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    const payments = resolvePayments(job.payments);
    const withPayments = { ...job, payments };
    const status = resolveJobStatus(withPayments);
    const updated: Job = {
      ...withPayments,
      id,
      status,
      leadOutcome: resolveLeadOutcome(withPayments),
      completedDate: resolveCompletedDate(jobs[idx].status, status, jobs[idx].completedDate, job.completedDate),
      createdAt: jobs[idx].createdAt,
      updatedAt: nowISO(),
    };
    jobs[idx] = updated;
    writeJobs(jobs);
    return updated;
  },

  async deleteJob(id: number): Promise<void> {
    writeJobs(readJobs().filter((j) => j.id !== id));
  },

  async listGasLogs(): Promise<GasLog[]> {
    return sortGas(readGas());
  },

  async createGasLog(entry: GasLog): Promise<GasLog> {
    const logs = readGas();
    const created: GasLog = { ...entry, id: nextId(GAS_SEQ_KEY), createdAt: nowISO() };
    logs.push(created);
    writeGas(logs);
    return created;
  },

  async deleteGasLog(id: number): Promise<void> {
    writeGas(readGas().filter((l) => l.id !== id));
  },

  async listTags(): Promise<Tag[]> {
    return readTags();
  },

  async createTag(tag: Tag): Promise<Tag> {
    const tags = readTags();
    const created: Tag = { ...tag, id: nextId(TAGS_SEQ_KEY) };
    tags.push(created);
    writeTags(tags);
    return created;
  },

  async deleteTag(id: number): Promise<void> {
    writeTags(readTags().filter((t) => t.id !== id));
  },
};
