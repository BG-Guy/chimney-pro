import { useEffect, useState } from "react";
import { api } from "../api";
import type { GasLog } from "../types";
import { todayISO } from "../dateUtils";

export default function GasLogPage() {
  const [logs, setLogs] = useState<GasLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .listGasLogs()
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value) return;
    setSaving(true);
    try {
      const entry = await api.createGasLog({ amount: value, date });
      setLogs((prev) => [entry, ...prev]);
      setAmount("");
      setDate(todayISO());
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteGasLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="gas-log">
      <form className="job-form" onSubmit={handleSubmit}>
        <label>
          Amount paid
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving || !amount}>
          {saving ? "Logging..." : "Log gas"}
        </button>
      </form>

      {loading ? (
        <p className="loading-text">Loading gas log...</p>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p>No gas logged yet.</p>
        </div>
      ) : (
        <div className="gas-rows">
          {logs.map((log) => (
            <div className="gas-row" key={log.id}>
              <span className="gas-row-date">{log.date}</span>
              <span className="gas-row-amount">${log.amount.toFixed(2)}</span>
              <button className="btn btn-danger" onClick={() => handleDelete(log.id!)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
