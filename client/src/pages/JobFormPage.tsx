import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_ICON,
  balanceRemaining,
  cashOwedToCompany,
  emptyJob,
  itemsTotal,
  jobTotal,
  partsTotal,
  paymentDateClearingBalance,
  roundCents,
  techProfit,
  paidTowardJob,
  paymentCardFee,
  totalCardFee,
  totalPaid,
  type DepositMethod,
  type Job,
  type JobPart,
  type Tag,
} from "../types";
import ChoiceBoxes, { type Choice } from "../components/ChoiceBoxes";
import DateButton from "../components/DateButton";
import Switch from "../components/Switch";
import { todayISO } from "../dateUtils";
import { formatMoney } from "../format";
import { extractCustomerName } from "../customerName";
import { extractTicketNumber } from "../ticketNumber";
import { extractAddress } from "../address";
import { extractScheduledTime } from "../scheduledTime";
import {
  ClipboardIcon,
  CloseIcon,
  WrenchIcon,
  WalletIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  PlusIcon,
} from "../components/icons";

const HOUR_RANGE_PRESETS = ["8-11", "9-12", "10-1", "11-2", "12-3", "1-4", "2-5"];

function formatPartDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

const PAID_METHOD_OPTIONS: Choice<DepositMethod>[] = DEPOSIT_METHODS.map((m) => ({
  value: m,
  label: m === "CC" ? "Card" : m,
  icon: DEPOSIT_METHOD_ICON[m as Exclude<DepositMethod, "">],
}));

export default function JobFormPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job>(emptyJob());
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [partName, setPartName] = useState("");
  const [partPrice, setPartPrice] = useState("");
  const canAddPart = partName.trim() !== "" && Number(partPrice) > 0;
  // The phone frame the save bar is pinned into — looked up once the page is on screen.
  const [viewport, setViewport] = useState<Element | null>(null);
  useEffect(() => setViewport(document.querySelector(".phone-viewport")), []);

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

  function setParts(update: (parts: JobPart[]) => JobPart[]) {
    setJob((prev) => {
      const parts = update(prev.parts);
      return { ...prev, parts, partsCost: partsTotal(parts) };
    });
  }

  function addPart() {
    if (!canAddPart) return;
    const part: JobPart = { description: partName.trim(), cost: Number(partPrice), date: todayISO() };
    setParts((parts) => [...parts, part]);
    setPartName("");
    setPartPrice("");
  }

  function removePart(index: number) {
    setParts((parts) => parts.filter((_, i) => i !== index));
  }

  // Enter adds the part instead of submitting the whole job form.
  function handlePartKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addPart();
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
      payments[index] = { ...payments[index], amount: Math.max(0, roundCents(itemsTotal(prev) - others)) };
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

  const isDeposit = paidTowardJob(job) > 0 && paidTowardJob(job) < jobTotal(job);
  const isDone = balanceRemaining(job) <= 0;
  const raw = job.rawTicketText;
  // What the app could read out of the pasted ticket — the same details the Jobs list and
  // Route tab use, shown here so a bad paste is caught before saving.
  const found = raw.trim()
    ? [
        { label: "Customer", value: extractCustomerName(raw) },
        { label: "Job number", value: extractTicketNumber(raw) },
        { label: "Address", value: extractAddress(raw) },
        { label: "Appointment", value: extractScheduledTime(raw) },
      ].filter((f): f is { label: string; value: string } => !!f.value)
    : [];

  return (
    <form id="job-form" className="job-form has-save-bar" onSubmit={handleSubmit}>
      {mode === "edit" && <p className="form-subtitle">Job #{id}</p>}

      <section className="group">
        <h2 className="group-title">Ticket</h2>
        <div className="group-card">
          <textarea
            className="ticket-input"
            rows={5}
            aria-label="Job ticket"
            value={job.rawTicketText}
            onChange={(e) => updateField("rawTicketText", e.target.value)}
            placeholder="Paste the job ticket here..."
          />
          <button type="button" className="row-button" onClick={handlePasteTicket}>
            <ClipboardIcon size={19} /> Paste from clipboard
          </button>
          {found.map((f) => (
            <div className="row" key={f.label}>
              <span className="row-label">{f.label}</span>
              <span className="row-value">{f.value}</span>
            </div>
          ))}
          <div className="row">
            <span className="row-label">Date logged</span>
            <DateButton value={job.loggedDate} onChange={(v) => updateField("loggedDate", v || todayISO())} />
          </div>
        </div>
      </section>

      <section className="group">
        <h2 className="group-title">Items</h2>
        <div className="group-card">
          {job.items.map((item, index) => (
            <div className="item-row" key={index}>
              <input
                type="text"
                placeholder="Item description"
                aria-label={`Item ${index + 1} description`}
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
              />
              <div className="item-row-line2">
                <div className="qty-stepper">
                  <button type="button" onClick={() => updateItemQuantity(index, -1)} aria-label="Decrease quantity">
                    −
                  </button>
                  <span>{item.quantity || 1}</span>
                  <button type="button" onClick={() => updateItemQuantity(index, 1)} aria-label="Increase quantity">
                    +
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="price-input"
                  placeholder="Price each"
                  aria-label={`Item ${index + 1} price each`}
                  value={item.cost || ""}
                  onChange={(e) => updateItem(index, "cost", e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button muted danger"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              {(item.quantity || 1) > 1 && item.cost > 0 && (
                <p className="item-line-total">= {formatMoney(item.cost * (item.quantity || 1))}</p>
              )}
            </div>
          ))}
          <button type="button" className="row-button" onClick={addItem}>
            <PlusIcon size={19} /> Add item
          </button>
        </div>
        <p className="group-footer">
          Items subtotal <strong>{formatMoney(itemsTotal(job))}</strong>
        </p>
      </section>

      <section className="group">
        <h2 className="group-title">Payments</h2>
        {job.payments.map((payment, index) => (
          <div className="group-card" key={index}>
            <label className="row">
              <span className="row-label">Amount</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="row-input"
                placeholder="0.00"
                value={payment.amount || ""}
                onChange={(e) => updatePayment(index, "amount", e.target.value)}
              />
            </label>
            <div className="row row-stack">
              <span className="row-label">Paid with</span>
              <ChoiceBoxes
                options={PAID_METHOD_OPTIONS}
                value={payment.method}
                onChange={(v) => updatePayment(index, "method", v)}
                allowDeselect
                deselectValue=""
              />
            </div>
            <div className="row">
              <span className="row-label">Date paid</span>
              <DateButton value={payment.date} onChange={(v) => updatePaymentDate(index, v)} placeholder="Today" />
            </div>
            {paymentCardFee(payment) > 0 && (
              <p className="row-note">
                Card charged <strong>{formatMoney(payment.amount + paymentCardFee(payment))}</strong> — includes a{" "}
                {formatMoney(paymentCardFee(payment))} card fee (3%). {formatMoney(payment.amount)} goes toward the job.
              </p>
            )}
            <button type="button" className="row-button" onClick={() => fillAllOfBalance(index)}>
              Pay the rest of the balance
            </button>
            <button type="button" className="row-button danger" onClick={() => removePayment(index)}>
              Remove payment
            </button>
          </div>
        ))}
        <div className="group-card">
          <button type="button" className="row-button" onClick={addPayment}>
            <PlusIcon size={19} /> Add payment
          </button>
        </div>
        <p className="group-footer">
          Total paid <strong>{formatMoney(totalPaid(job))}</strong>
          {totalCardFee(job) > 0 &&
            ` — includes ${formatMoney(totalCardFee(job))} card fee; ${formatMoney(paidTowardJob(job))} goes toward the job`}
        </p>
      </section>

      <section className="group">
        <h2 className="group-title">Parts</h2>
        <div className="group-card">
          {job.parts.length === 0 && (
            <p className="row-note">No parts yet — add each part you used with its price.</p>
          )}
          {job.parts.map((part, index) => (
            <div className="part-row" key={index}>
              <span className="part-icon">
                <TagIcon size={16} />
              </span>
              <span className="part-info">
                <span className="part-name">{part.description || "Part"}</span>
                <span className="part-date">Added {formatPartDate(part.date)}</span>
              </span>
              <span className="part-cost">{formatMoney(part.cost)}</span>
              <button
                type="button"
                className="part-remove"
                aria-label={`Remove ${part.description || "part"}`}
                onClick={() => removePart(index)}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
          <div className="part-add">
            <input
              type="text"
              placeholder="Part name"
              aria-label="Part name"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              onKeyDown={handlePartKeyDown}
            />
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className="part-price"
              placeholder="Price"
              aria-label="Part price"
              value={partPrice}
              onChange={(e) => setPartPrice(e.target.value)}
              onKeyDown={handlePartKeyDown}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={!canAddPart} onClick={addPart}>
              Add
            </button>
          </div>
        </div>
        <p className="group-footer">
          Parts total <strong>{formatMoney(partsTotal(job.parts))}</strong>
        </p>
      </section>

      <section className="group">
        <h2 className="group-title">Schedule</h2>
        <div className="group-card">
          <div className="row">
            <span className="row-label">Job date</span>
            <DateButton value={job.scheduledDate} onChange={(v) => updateField("scheduledDate", v)} placeholder="Pick a date" />
          </div>
          <div className="row row-stack">
            <div className="hours-line">
              <label className="row-label" htmlFor="hour-range">
                Hours
              </label>
              <input
                id="hour-range"
                type="text"
                className="row-input"
                placeholder="e.g. 9-12"
                value={job.scheduledTimeRange}
                onChange={(e) => updateField("scheduledTimeRange", e.target.value)}
              />
            </div>
            <div className="chip-scroll-row">
              {HOUR_RANGE_PRESETS.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`chip-pill${job.scheduledTimeRange === range ? " selected" : ""}`}
                  aria-pressed={job.scheduledTimeRange === range}
                  onClick={() => updateField("scheduledTimeRange", job.scheduledTimeRange === range ? "" : range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <span className="row-label">Repair team needed</span>
            <Switch
              checked={job.needsRepairTeam}
              onChange={(v) => updateField("needsRepairTeam", v)}
              label="Repair team needed"
            />
          </div>
        </div>
      </section>

      {tags.length > 0 && (
        <section className="group">
          <h2 className="group-title">Tags</h2>
          <div className="group-card group-pad">
            <div className="tag-color-picker">
              {tags.map((tag) => {
                const selected = job.tagIds.includes(tag.id!);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip tag-chip-toggle${selected ? " selected" : ""}`}
                    style={{ background: `var(--${tag.color})` }}
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id!)}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="group">
        <h2 className="group-title">Summary</h2>
        <div className="group-card">
          <div className="row">
            <span className="row-label">Total job cost</span>
            <strong>{formatMoney(jobTotal(job))}</strong>
          </div>
          <div className="row">
            <span className="row-label">Total paid</span>
            <span className="row-value">{formatMoney(totalPaid(job))}</span>
          </div>
          <div className="row">
            <span className="row-label">Balance remaining</span>
            <strong>{formatMoney(balanceRemaining(job))}</strong>
          </div>
          <div className="row">
            <span className="row-label">Tech profit</span>
            <span className="row-value">
              {formatMoney(techProfit(job))} <span className="form-hint">· 25% after parts</span>
            </span>
          </div>
          <div className="row">
            <span className="row-label">Status</span>
            <span className="row-value status-value">
              {isDone ? (
                <>
                  <CheckCircleIcon size={16} /> Done · {paymentDateClearingBalance(job) ?? todayISO()}
                </>
              ) : (
                <>
                  <ClockIcon size={16} /> Awaiting
                </>
              )}
            </span>
          </div>
          {(isDeposit || job.needsRepairTeam) && (
            <div className="row">
              <div className="badge-row">
                {isDeposit && (
                  <span className="badge accent">
                    <WalletIcon size={13} /> Deposit
                  </span>
                )}
                {job.needsRepairTeam && (
                  <span className="badge repair">
                    <WrenchIcon size={13} /> Repair team
                  </span>
                )}
              </div>
            </div>
          )}
          {cashOwedToCompany(job) > 0 && (
            <p className="row-note warn">Paid in cash — tech owes company {formatMoney(cashOwedToCompany(job))}</p>
          )}
        </div>
        <p className="group-footer">The status is set automatically once the balance is paid off.</p>
      </section>

      <button type="button" className="btn btn-plain" onClick={() => navigate("/jobs")}>
        Cancel
      </button>

      {/* Pinned above the tab bar (rendered into the phone frame, not the scrolling page), so
          the balance and Save are always in reach; it submits this form by its id. */}
      {viewport &&
        createPortal(
          <div className="save-bar">
            <div className="save-bar-figure">
              <span>Balance</span>
              <strong>{formatMoney(balanceRemaining(job))}</strong>
            </div>
            <div className="save-bar-figure">
              <span>Tech profit</span>
              <strong>{formatMoney(techProfit(job))}</strong>
            </div>
            <button type="submit" form="job-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save job"}
            </button>
          </div>,
          viewport
        )}
    </form>
  );
}
