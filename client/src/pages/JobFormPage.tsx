import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
  CC_FEE_RATE,
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_EMOJI,
  STATUS_EMOJI,
  balanceRemaining,
  cashOwedToCompany,
  emptyJob,
  itemsTotal,
  jobTotal,
  techProfit,
  totalPaid,
  type DepositMethod,
  type Job,
  type Tag,
} from "../types";
import ChoiceBoxes, { type Choice } from "../components/ChoiceBoxes";
import DateButton from "../components/DateButton";
import { todayISO } from "../dateUtils";

const STATUS_OPTIONS: Choice<Job["status"]>[] = [
  { value: "awaiting", label: "Awaits", emoji: STATUS_EMOJI.awaiting },
  { value: "done", label: "Done", emoji: STATUS_EMOJI.done },
];

const PAID_METHOD_OPTIONS: Choice<DepositMethod>[] = DEPOSIT_METHODS.map((m) => ({
  value: m,
  label: m,
  emoji: DEPOSIT_METHOD_EMOJI[m as Exclude<DepositMethod, "">],
}));

export default function JobFormPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job>(emptyJob());
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (mode === "edit" && id) {
      api
        .getJob(Number(id))
        .then((loaded) => setJob(loaded))
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

  function updateItemQuantity(index: number, delta: number) {
    setJob((prev) => {
      const items = [...prev.items];
      const next = Math.max(1, (items[index].quantity || 1) + delta);
      items[index] = { ...items[index], quantity: next };
      return { ...prev, items };
    });
  }

  function addItem() {
    setJob((prev) => ({ ...prev, items: [...prev.items, { description: "", cost: 0, quantity: 1 }] }));
  }

  function removeItem(index: number) {
    setJob((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function updatePayment(index: number, field: "amount" | "method", value: string) {
    setJob((prev) => {
      const payments = [...prev.payments];
      payments[index] = {
        ...payments[index],
        [field]: field === "amount" ? Number(value) || 0 : (value as DepositMethod),
      };
      return { ...prev, payments };
    });
  }

  function updatePaymentDate(index: number, value: string | null) {
    setJob((prev) => {
      const payments = [...prev.payments];
      payments[index] = { ...payments[index], date: value };
      return { ...prev, payments };
    });
  }

  function addPayment() {
    setJob((prev) => ({ ...prev, payments: [...prev.payments, { amount: 0, method: "", date: null }] }));
  }

  function removePayment(index: number) {
    setJob((prev) => ({ ...prev, payments: prev.payments.filter((_, i) => i !== index) }));
  }

  function fillAllOfBalance(index: number) {
    setJob((prev) => {
      const others = prev.payments.reduce(
        (sum, p, i) => (i === index ? sum : sum + (Number(p.amount) || 0)),
        0
      );
      const payments = [...prev.payments];
      payments[index] = { ...payments[index], amount: Math.max(0, jobTotal(prev) - others) };
      return { ...prev, payments };
    });
  }

  async function handlePasteTicket() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) updateField("rawTicketText", text);
    } catch {
      alert("Couldn't read the clipboard. Your browser may need permission, or there's nothing copied.");
    }
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
      navigate("/jobs");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-text">Loading job...</p>;

  const isDeposit = totalPaid(job) > 0 && totalPaid(job) < jobTotal(job);

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
      <button type="button" className="btn btn-sm" onClick={handlePasteTicket}>
        📋 Paste from clipboard
      </button>

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
            <div className="item-row-line2">
              <div className="qty-stepper">
                <button type="button" onClick={() => updateItemQuantity(index, -1)} aria-label="Decrease quantity">
                  −
                </button>
                <span>{item.quantity || 1}x</span>
                <button type="button" onClick={() => updateItemQuantity(index, 1)} aria-label="Increase quantity">
                  +
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Cost each"
                value={item.cost || ""}
                onChange={(e) => updateItem(index, "cost", e.target.value)}
              />
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(index)}>
                Remove
              </button>
            </div>
            {(item.quantity || 1) > 1 && item.cost > 0 && (
              <p className="item-line-total">= ${(item.cost * (item.quantity || 1)).toFixed(2)}</p>
            )}
          </div>
        ))}
        <button type="button" className="btn" onClick={addItem}>
          + Add item
        </button>
        <p className="subtotal">Items subtotal: ${itemsTotal(job).toFixed(2)}</p>
      </fieldset>

      <fieldset>
        <legend>Payments</legend>
        {job.payments.map((payment, index) => (
          <div className="payment-row" key={index}>
            <div className="paid-amount-row">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={payment.amount || ""}
                onChange={(e) => updatePayment(index, "amount", e.target.value)}
              />
              <button type="button" className="btn" onClick={() => fillAllOfBalance(index)}>
                All of balance
              </button>
            </div>
            <ChoiceBoxes
              options={PAID_METHOD_OPTIONS}
              value={payment.method}
              onChange={(v) => updatePayment(index, "method", v)}
              allowDeselect
              deselectValue=""
            />
            <DateButton
              value={payment.date}
              onChange={(v) => updatePaymentDate(index, v)}
              placeholder="Date paid (defaults to today)"
            />
            {payment.method === "CC" && payment.amount > 0 && (
              <p className="cash-owed-callout">
                +${(payment.amount * CC_FEE_RATE).toFixed(2)} CC fee (3%) on this payment
              </p>
            )}
            <button type="button" className="btn btn-danger" onClick={() => removePayment(index)}>
              Remove payment
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={addPayment}>
          + Add payment
        </button>
        <p className="subtotal">Total paid: ${totalPaid(job).toFixed(2)}</p>
      </fieldset>

      {(isDeposit || job.needsRepairTeam) && (
        <div className="ticket-tags-preview">
          {isDeposit && <span className="deposit-badge">💰 DEPOSIT</span>}
          {job.needsRepairTeam && <span className="repair-badge">🔧 REPAIR TEAM</span>}
        </div>
      )}

      <label>
        Parts cost
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          className="input-sm"
          value={job.partsCost || ""}
          onChange={(e) => updateField("partsCost", Number(e.target.value) || 0)}
        />
      </label>

      <p className="total">Total job cost: ${jobTotal(job).toFixed(2)}</p>
      <p className="subtotal">Balance remaining: ${balanceRemaining(job).toFixed(2)}</p>
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

      <label>
        Repair team
        <button
          type="button"
          className={`choice-box choice-box-sm${job.needsRepairTeam ? " selected" : ""}`}
          onClick={() => updateField("needsRepairTeam", !job.needsRepairTeam)}
        >
          <span className="choice-emoji">🔧</span>
          <span className="choice-label">Repair team needed</span>
        </button>
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
        Date job was completed
        <DateButton
          value={job.completedDate}
          onChange={(v) => updateField("completedDate", v || todayISO())}
        />
      </label>

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
