import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { DEPOSIT_METHODS, emptyJob, itemsTotal, jobTotal, type Job } from "../types";

export default function JobFormPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job>(emptyJob());
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && id) {
      api
        .getJob(Number(id))
        .then(setJob)
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function updateField<K extends keyof Job>(key: K, value: Job[K]) {
    setJob((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, field: "description" | "cost", value: string) {
    setJob((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        [field]: field === "cost" ? Number(value) || 0 : value,
      };
      return { ...prev, items };
    });
  }

  function addItem() {
    setJob((prev) => ({ ...prev, items: [...prev.items, { description: "", cost: 0 }] }));
  }

  function removeItem(index: number) {
    setJob((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "new") {
        await api.createJob(job);
      } else {
        await api.updateJob(Number(id), job);
      }
      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading job...</p>;

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <h2>{mode === "new" ? "New Job" : `Edit Job #${id}`}</h2>

      <label>
        Paste job ticket
        <textarea
          rows={6}
          value={job.rawTicketText}
          onChange={(e) => updateField("rawTicketText", e.target.value)}
          placeholder="Paste the raw job ticket text here..."
        />
      </label>

      <fieldset>
        <legend>Items</legend>
        {job.items.map((item, index) => (
          <div className="item-row" key={index}>
            <input
              type="text"
              placeholder="Item description"
              value={item.description}
              onChange={(e) => updateItem(index, "description", e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Cost"
              value={item.cost}
              onChange={(e) => updateItem(index, "cost", e.target.value)}
            />
            <button type="button" className="btn btn-danger" onClick={() => removeItem(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={addItem}>
          + Add item
        </button>
        <p className="subtotal">Items subtotal: ${itemsTotal(job).toFixed(2)}</p>
      </fieldset>

      <label>
        Parts cost
        <input
          type="number"
          step="0.01"
          value={job.partsCost}
          onChange={(e) => updateField("partsCost", Number(e.target.value) || 0)}
        />
      </label>

      <p className="total">Total job cost: ${jobTotal(job).toFixed(2)}</p>

      <label>
        Date job will be done
        <input
          type="date"
          value={job.scheduledDate ?? ""}
          onChange={(e) => updateField("scheduledDate", e.target.value || null)}
        />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={job.needsRepairTeam}
          onChange={(e) => updateField("needsRepairTeam", e.target.checked)}
        />
        Needs repair team
      </label>

      <label>
        Deposit amount
        <input
          type="number"
          step="0.01"
          value={job.depositAmount}
          onChange={(e) => updateField("depositAmount", Number(e.target.value) || 0)}
        />
      </label>

      <label>
        Deposit method
        <select
          value={job.depositMethod}
          onChange={(e) => updateField("depositMethod", e.target.value as Job["depositMethod"])}
        >
          <option value="">Select method</option>
          {DEPOSIT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Job"}
        </button>
        <button type="button" className="btn" onClick={() => navigate("/")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
