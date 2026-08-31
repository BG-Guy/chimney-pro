import {
  jobTotal,
  paymentDateClearingBalance,
  totalPaid,
  type GasLog,
  type Job,
  type JobStatus,
  type LeadOutcome,
  type Payment,
  type Tag,
} from "./types";
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

// The tech gets paid out when the balance actually clears, so that's the date worth
// tracking — not "today, whenever this happens to get saved." Recomputed fresh from the
// payments every save, so editing a payment's date retroactively corrects it.
function resolveCompletedDate(status: JobStatus, job: Job): string | null {
  if (status !== "done") return null;
  return paymentDateClearingBalance(job) ?? todayISO();
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

// Job status is derived the same way: awaiting until the balance clears, then done (and
// ready for the paycheck). A job with no items and no payments has a $0 balance too, so it
// counts as done.
function resolveJobStatus(job: Job): JobStatus {
  const total = jobTotal(job);
  const paid = totalPaid(job);
  return paid >= total ? "done" : "awaiting";
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
    const withMigratedFields: Job = {
      ...job,
      tagIds: job.tagIds ?? [],
      loggedDate: job.loggedDate ?? job.createdAt?.slice(0, 10) ?? todayISO(),
      items: (job.items ?? []).map((item: any) => ({ ...item, quantity: item.quantity ?? 1 })),
      payments,
    };
    return {
      ...withMigratedFields,
      completedDate:
        job.completedDate ??
        (job.status === "done"
          ? paymentDateClearingBalance(withMigratedFields) ?? job.updatedAt?.slice(0, 10) ?? null
          : null),
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
      completedDate: resolveCompletedDate(status, withPayments),
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
      completedDate: resolveCompletedDate(status, withPayments),
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

  // A standalone home-screen web app gets its own storage box, walled off from whatever
  // browser tab the data was originally entered in — export/import is the escape hatch to
  // move data between them (and a manual backup either way, since localStorage isn't safe
  // from the OS clearing it).
  async exportAll(): Promise<string> {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: nowISO(),
        jobs: read<any[]>(JOBS_KEY, []),
        jobsSeq: read<number>(JOBS_SEQ_KEY, 0),
        gas: read<GasLog[]>(GAS_KEY, []),
        gasSeq: read<number>(GAS_SEQ_KEY, 0),
        tags: read<Tag[]>(TAGS_KEY, []),
        tagsSeq: read<number>(TAGS_SEQ_KEY, 0),
      },
      null,
      2
    );
  },

  async importAll(json: string): Promise<void> {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !Array.isArray(data.jobs)) {
      throw new Error("That file doesn't look like a Chimney Pro backup.");
    }
    write(JOBS_KEY, data.jobs);
    write(JOBS_SEQ_KEY, data.jobsSeq ?? 0);
    write(GAS_KEY, data.gas ?? []);
    write(GAS_SEQ_KEY, data.gasSeq ?? 0);
    write(TAGS_KEY, data.tags ?? []);
    write(TAGS_SEQ_KEY, data.tagsSeq ?? 0);
  },
};
