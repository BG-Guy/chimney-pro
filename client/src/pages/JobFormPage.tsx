import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_EMOJI,
  LEAD_OUTCOME_EMOJI,
  LEAD_OUTCOME_LABEL,
  STATUS_EMOJI,
  cashOwedToCompany,
  ccFee,
  emptyJob,
  itemsTotal,
  jobTotal,
  techProfit,
  type Job,
  type LeadOutcome,
  type Tag,
} from "../types";
import ChoiceBoxes, { type Choice } from "../components/ChoiceBoxes";
import DateButton from "../components/DateButton";
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

const LEAD_OUTCOME_OPTIONS: Choice<LeadOutcome>[] = (["estimate", "deposit", "no_estimate"] as LeadOutcome[]).map(
  (v) => ({ value: v, label: LEAD_OUTCOME_LABEL[v], emoji: LEAD_OUTCOME_EMOJI[v] })
);

function inferLeadOutcome(job: Job): LeadOutcome {
  if (job.leadOutcome) return job.leadOutcome;
  return job.depositAmount > 0 ? "deposit" : "estimate";
}

export default function JobFormPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job>(emptyJob());
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const depositMade = job.leadOutcome === "deposit";

  useEffect(() => {
    if (mode === "edit" && id) {
      api
        .getJob(Number(id))
        .then((loaded) => {
          setJob({ ...loaded, leadOutcome: inferLeadOutcome(loaded) });
        })
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  useEffect(() => {
    api.listTags().then(setTags);
  }, []);

  function toggleTag(tagId: number) {
    setJob((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((t) => t !== tagId)
        : [...prev.tagIds, tagId],
    }));
  }

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

      <label>
        Date logged
        <DateButton
          value={job.loggedDate}
          onChange={(v) => updateField("loggedDate", v || todayISO())}
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
              value={item.cost || ""}
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
          placeholder="0.00"
          value={job.partsCost || ""}
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
        <DateButton value={job.scheduledDate} onChange={(v) => updateField("scheduledDate", v)} />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={job.needsRepairTeam}
          onChange={(e) => updateField("needsRepairTeam", e.target.checked)}
        />
        Needs repair team
      </label>

      {tags.length > 0 && (
        <label>
          Tags
          <div className="tag-color-picker">
            {tags.map((tag) => {
              const selected = job.tagIds.includes(tag.id!);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip tag-chip-toggle${selected ? " selected" : ""}`}
                  style={{ background: `var(--${tag.color})` }}
                  onClick={() => toggleTag(tag.id!)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </label>
      )}

      <label>
        Job status
        <ChoiceBoxes options={STATUS_OPTIONS} value={job.status} onChange={(v) => updateField("status", v)} />
      </label>

      <label>
        Outcome
        <ChoiceBoxes
          options={LEAD_OUTCOME_OPTIONS}
          value={job.leadOutcome}
          onChange={(v) => updateField("leadOutcome", v)}
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
              placeholder="0.00"
              value={job.depositAmount || ""}
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

          {job.depositMethod === "CC" && job.depositAmount > 0 && (
            <p className="cash-owed-callout">
              +${ccFee(job).toFixed(2)} CC fee (3%) — charge ${(job.depositAmount + ccFee(job)).toFixed(2)} total
            </p>
          )}
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
