import type { Job } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listJobs: () => request<Job[]>("/api/jobs"),
  getJob: (id: number) => request<Job>(`/api/jobs/${id}`),
  createJob: (job: Job) =>
    request<Job>("/api/jobs", { method: "POST", body: JSON.stringify(job) }),
  updateJob: (id: number, job: Job) =>
    request<Job>(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(job) }),
  deleteJob: (id: number) => request<void>(`/api/jobs/${id}`, { method: "DELETE" }),
};
