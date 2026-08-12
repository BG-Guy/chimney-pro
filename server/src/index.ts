import express from "express";
import cors from "cors";
import { createJob, deleteJob, getJob, listJobs, updateJob } from "./jobsRepo.js";
import type { Job } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

function normalizeJob(body: any): Job {
  return {
    rawTicketText: body.rawTicketText ?? "",
    items: Array.isArray(body.items)
      ? body.items.map((i: any) => ({ description: i.description ?? "", cost: Number(i.cost) || 0 }))
      : [],
    partsCost: Number(body.partsCost) || 0,
    scheduledDate: body.scheduledDate || null,
    needsRepairTeam: !!body.needsRepairTeam,
    depositAmount: Number(body.depositAmount) || 0,
    depositMethod: body.depositMethod ?? "",
  };
}

app.get("/api/jobs", (_req, res) => {
  res.json(listJobs());
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(Number(req.params.id));
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.post("/api/jobs", (req, res) => {
  const job = createJob(normalizeJob(req.body));
  res.status(201).json(job);
});

app.put("/api/jobs/:id", (req, res) => {
  const job = updateJob(Number(req.params.id), normalizeJob(req.body));
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.delete("/api/jobs/:id", (req, res) => {
  const ok = deleteJob(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Job not found" });
  res.status(204).end();
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Chimney Pro server listening on http://localhost:${PORT}`);
});
