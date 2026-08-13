import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_EMOJI,
  STATUS_EMOJI,
  cashOwedToCompany,
  emptyJob,
  itemsTotal,
  jobTotal,
  techProfit,
  type Job,
} from "../types";
import ChoiceBoxes, { type Choice } from "../components/ChoiceBoxes";
import { todayISO } from "../dateUtils";

const STATUS_OPTIONS: Choice<Job["status"]>[] = [
  { value: "awaiting", label: "Awaits", emoji: STATUS_EMOJI.awaiting },
  { value: "done", label: "Done", emoji: STATUS_EMOJI.done },
];

const DEPOSIT_METHOD_OPTIONS: Choice<Job["depositMethod"]>[] = DEPOSIT_METHODS.map((m) => ({
  value: m,
  label: m,
  emoji: DEPOSIT_METHOD_EMOJI[m as Exclude<Job["depositMethod"], "">],
}));

const DEPOSIT_MADE_OPTIONS: Choice<"yes" | "no">[] = [
  { value: "yes", label: "Yes", emoji: "💰" },
  { value: "no", label: "No", emoji: "🚫" },
];

export default function JobFormPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job>(emptyJob());
  const [depositMade, setDepositMade] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && id) {
      api
        .getJob(Number(id))
        .then((loaded) => {
          setJob(loaded);
          setDepositMade(loaded.depositAmount > 0 || !!loaded.depositMethod || !!loaded.depositDate);
        })
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
      const payload: Job = depositMade
        ? { ...job, depositDate: job.depositDate || todayISO() }
        : { ...job, depositAmount: 0, depositMethod: "", depositDate: null };

      if (mode === "new") {
        await api.createJob(payload);
      } else {
        await api.updateJob(Number(id), payload);
      }
      navigate("/jobs");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-text">Loading job...</p>;

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      {mode === "edit" && <p className="form-subtitle">Job #{id}</p>}

      <label>
        Paste job ticket
        <textarea
          rows={5}
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
              inputMode="decimal"
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
          inputMode="decimal"
          value={job.partsCost}
          onChange={(e) => updateField("partsCost", Number(e.target.value) || 0)}
        />
      </label>

      <p className="total">Total job cost: ${jobTotal(job).toFixed(2)}</p>
      <p className="subtotal">Tech profit (25% after parts): ${techProfit(job).toFixed(2)}</p>
      {cashOwedToCompany(job) > 0 && (
        <p className="cash-owed-callout">
          Paid in cash — tech owes company ${cashOwedToCompany(job).toFixed(2)}
        </p>
      )}

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
        Job status
        <ChoiceBoxes options={STATUS_OPTIONS} value={job.status} onChange={(v) => updateField("status", v)} />
      </label>

      <label>
        Deposit made?
        <ChoiceBoxes
          options={DEPOSIT_MADE_OPTIONS}
          value={depositMade ? "yes" : "no"}
          onChange={(v) => setDepositMade(v === "yes")}
        />
      </label>

      {depositMade && (
        <>
          <label>
            How much
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={job.depositAmount}
              onChange={(e) => updateField("depositAmount", Number(e.target.value) || 0)}
            />
          </label>

          <label>
            Deposit method
            <ChoiceBoxes
              options={DEPOSIT_METHOD_OPTIONS}
              value={job.depositMethod}
              onChange={(v) => updateField("depositMethod", v)}
              allowDeselect
              deselectValue=""
            />
          </label>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Job"}
        </button>
        <button type="button" className="btn" onClick={() => navigate("/jobs")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
