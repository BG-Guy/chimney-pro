import type { GasLog, Job, JobStatus, Tag } from "./types";
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

function readJobs(): Job[] {
  // Jobs saved before a field was added won't have it in storage; backfill defaults
  // (and migrate the old deposit* fields to paid*) so old records don't crash newer UI.
  return read<any[]>(JOBS_KEY, []).map(
    (job): Job => ({
      ...job,
      tagIds: job.tagIds ?? [],
      loggedDate: job.loggedDate ?? job.createdAt?.slice(0, 10) ?? todayISO(),
      paid: job.paid ?? (job.paidAmount ?? job.depositAmount ?? 0) > 0,
      paidAmount: job.paidAmount ?? job.depositAmount ?? 0,
      paidMethod: job.paidMethod ?? job.depositMethod ?? "",
      paidDate: job.paidDate ?? job.depositDate ?? null,
    })
  );
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
    if (!a.scheduledDate && !b.scheduledDate) return (b.id ?? 0) - (a.id ?? 0);
    if (!a.scheduledDate) return 1;
    if (!b.scheduledDate) return -1;
    if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1;
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
    const created: Job = { ...job, id: nextId(JOBS_SEQ_KEY), createdAt: now, updatedAt: now };
    jobs.push(created);
    writeJobs(jobs);
    return created;
  },

  async updateJob(id: number, job: Job): Promise<Job> {
    const jobs = readJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    const updated: Job = { ...job, id, createdAt: jobs[idx].createdAt, updatedAt: nowISO() };
    jobs[idx] = updated;
    writeJobs(jobs);
    return updated;
  },

  async deleteJob(id: number): Promise<void> {
    writeJobs(readJobs().filter((j) => j.id !== id));
  },

  async setStatus(id: number, status: JobStatus): Promise<Job> {
    const jobs = readJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    jobs[idx] = { ...jobs[idx], status, updatedAt: nowISO() };
    writeJobs(jobs);
    return jobs[idx];
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
