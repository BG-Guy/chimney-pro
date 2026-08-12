import { db } from "./db.js";
import type { Job, JobItem } from "./types.js";

function loadItems(jobId: number): JobItem[] {
  const rows = db
    .prepare("SELECT id, description, cost FROM job_items WHERE jobId = ? ORDER BY sortOrder ASC, id ASC")
    .all(jobId) as JobItem[];
  return rows;
}

function rowToJob(row: any): Job {
  return {
    id: row.id,
    rawTicketText: row.rawTicketText,
    items: loadItems(row.id),
    partsCost: row.partsCost,
    scheduledDate: row.scheduledDate,
    needsRepairTeam: !!row.needsRepairTeam,
    depositAmount: row.depositAmount,
    depositMethod: row.depositMethod,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listJobs(): Job[] {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY scheduledDate IS NULL, scheduledDate ASC, id DESC").all();
  return rows.map(rowToJob);
}

export function getJob(id: number): Job | undefined {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return row ? rowToJob(row) : undefined;
}

function replaceItems(jobId: number, items: JobItem[]) {
  db.prepare("DELETE FROM job_items WHERE jobId = ?").run(jobId);
  const insert = db.prepare(
    "INSERT INTO job_items (jobId, description, cost, sortOrder) VALUES (?, ?, ?, ?)"
  );
  items.forEach((item, index) => {
    insert.run(jobId, item.description, item.cost, index);
  });
}

export function createJob(job: Job): Job {
  const result = db
    .prepare(
      `INSERT INTO jobs (rawTicketText, partsCost, scheduledDate, needsRepairTeam, depositAmount, depositMethod, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      job.rawTicketText,
      job.partsCost,
      job.scheduledDate,
      job.needsRepairTeam ? 1 : 0,
      job.depositAmount,
      job.depositMethod
    );
  const id = result.lastInsertRowid as number;
  replaceItems(id, job.items);
  return getJob(id)!;
}

export function updateJob(id: number, job: Job): Job | undefined {
  const existing = getJob(id);
  if (!existing) return undefined;
  db.prepare(
    `UPDATE jobs SET rawTicketText = ?, partsCost = ?, scheduledDate = ?, needsRepairTeam = ?,
       depositAmount = ?, depositMethod = ?, updatedAt = datetime('now')
     WHERE id = ?`
  ).run(
    job.rawTicketText,
    job.partsCost,
    job.scheduledDate,
    job.needsRepairTeam ? 1 : 0,
    job.depositAmount,
    job.depositMethod,
    id
  );
  replaceItems(id, job.items);
  return getJob(id);
}

export function deleteJob(id: number): boolean {
  const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return result.changes > 0;
}
