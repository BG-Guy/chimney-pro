import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { computeInsights, pctDelta, type Insights } from "../insights";
import { computeGasInsights, type GasInsights } from "../gasInsights";
import { computeWeeklyReports, downloadWeeklyReportCsv, type WeeklyReport } from "../weeklyReports";
import { DEPOSIT_METHOD_EMOJI, type GasLog, type Job } from "../types";

function formatCompactMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function DeltaBadge({ value, upIsGood = true }: { value: number | null; upIsGood?: boolean }) {
  if (value === null) return <span className="delta delta-neutral">new</span>;
  const rounded = Math.round(value);
  if (rounded === 0) return <span className="delta delta-neutral">flat</span>;
  const isUp = rounded > 0;
  const isGood = isUp === upIsGood;
  return (
    <span className={`delta ${isGood ? "delta-up" : "delta-down"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(rounded)}%
    </span>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function ComparisonCard({
  title,
  caption,
  current,
  previous,
}: {
  title: string;
  caption: string;
  current: { jobCount: number; revenue: number };
  previous: { jobCount: number; revenue: number };
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="card-caption">{caption}</span>
      </div>
      <div className="comparison-row">
        <div className="comparison-metric">
          <span className="comparison-label">Jobs</span>
          <span className="comparison-value">{current.jobCount}</span>
          <DeltaBadge value={pctDelta(current.jobCount, previous.jobCount)} />
        </div>
        <div className="comparison-metric">
          <span className="comparison-label">Revenue</span>
          <span className="comparison-value">{formatCompactMoney(current.revenue)}</span>
          <DeltaBadge value={pctDelta(current.revenue, previous.revenue)} />
        </div>
      </div>
    </div>
  );
}

function GasComparisonCard({
  title,
  caption,
  current,
  previous,
}: {
  title: string;
  caption: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="card-caption">{caption}</span>
      </div>
      <div className="comparison-row">
        <div className="comparison-metric">
          <span className="comparison-label">Spent on gas</span>
          <span className="comparison-value">{formatCompactMoney(current)}</span>
          <DeltaBadge value={pctDelta(current, previous)} upIsGood={false} />
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  title,
  caption,
  points,
  color,
}: {
  title: string;
  caption: string;
  points: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 280;
  const h = 64;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: h - (p.value / max) * (h - 12) - 4,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="card-caption">{caption}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
        <path d={areaPath} fill={color} opacity="0.1" stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--surface-1)" strokeWidth="2" />
      </svg>
      <div className="sparkline-labels">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function Meter({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{label}</h3>
        <span className="card-caption">{sub}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="meter-value">{pct.toFixed(0)}%</span>
    </div>
  );
}

const METHOD_SLOTS: Record<string, string> = {
  CC: "var(--series-1)",
  Check: "var(--series-2)",
  Zelle: "var(--series-3)",
  Cash: "var(--series-4)",
  Other: "var(--series-5)",
};

function PaidMethods({ counts }: { counts: Insights["paidMethodCounts"] }) {
  const entries = Object.entries(counts) as [string, number][];
  const total = entries.reduce((sum, [, c]) => sum + c, 0);

  if (entries.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Payment methods</h3>
        </div>
        <p className="empty-hint">No payments recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Payment methods</h3>
      </div>
      <div className="method-bars">
        {entries
          .sort((a, b) => b[1] - a[1])
          .map(([method, count]) => (
            <div className="method-bar-row" key={method}>
              <span className="method-bar-label">
                {DEPOSIT_METHOD_EMOJI[method as keyof typeof DEPOSIT_METHOD_EMOJI]} {method}
              </span>
              <div className="method-bar-track">
                <div
                  className="method-bar-fill"
                  style={{ width: `${(count / total) * 100}%`, background: METHOD_SLOTS[method] ?? "var(--series-1)" }}
                />
              </div>
              <span className="method-bar-count">{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function WeeklyReports({ reports }: { reports: WeeklyReport[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Weekly reports</h3>
      </div>
      <div className="week-report-list">
        {reports.map((report) => {
          const isOpen = expandedKey === report.key;
          return (
            <div className="week-report" key={report.key}>
              <button
                type="button"
                className="week-report-row"
                onClick={() => setExpandedKey(isOpen ? null : report.key)}
              >
                <span className="week-report-info">
                  <span className="week-report-title">{report.label}</span>
                  <span className="week-report-dates">{report.dateRange}</span>
                </span>
                <span className="week-report-jobcount">
                  {report.jobs.length} job{report.jobs.length === 1 ? "" : "s"}
                </span>
              </button>

              {isOpen && (
                <div className="week-report-detail">
                  {report.jobs.length === 0 ? (
                    <p className="empty-hint">No jobs scheduled this week.</p>
                  ) : (
                    <>
                      <div className="week-report-jobs">
                        {report.jobs.map((j) => (
                          <div className="week-report-job" key={j.id}>
                            <div className="week-report-job-top">
                              <span>
                                #{j.id}
                                {j.customerName ? ` · ${j.customerName}` : ""}
                              </span>
                              <span>${j.total.toFixed(2)}</span>
                            </div>
                            <dl className="job-card-details">
                              <div>
                                <dt>Parts</dt>
                                <dd>${j.partsCost.toFixed(2)}</dd>
                              </div>
                              <div>
                                <dt>Tech profit</dt>
                                <dd>${j.techProfit.toFixed(2)}</dd>
                              </div>
                              <div>
                                <dt>Paid</dt>
                                <dd>
                                  ${j.paid.toFixed(2)}
                                  {j.paidMethods ? ` (${j.paidMethods})` : ""}
                                </dd>
                              </div>
                              <div>
                                <dt>Balance</dt>
                                <dd>${j.balance.toFixed(2)}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                      <p className="subtotal">
                        Totals — Revenue ${report.totals.total.toFixed(2)} · Parts $
                        {report.totals.partsCost.toFixed(2)} · Tech profit $
                        {report.totals.techProfit.toFixed(2)} · Paid ${report.totals.paid.toFixed(2)} · Balance $
                        {report.totals.balance.toFixed(2)}
                      </p>
                    </>
                  )}
                  <button type="button" className="btn" onClick={() => downloadWeeklyReportCsv(report)}>
                    ⬇️ Export CSV
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TechPayouts({ insights }: { insights: Insights }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Tech payouts</h3>
        <span className="card-caption">25% after parts</span>
      </div>
      <div className="comparison-row">
        <div className="comparison-metric">
          <span className="comparison-label">Tech profit (total)</span>
          <span className="comparison-value">{formatMoney(insights.totalTechProfit)}</span>
        </div>
      </div>
      {insights.totalCashOwed > 0 && (
        <p className="cash-owed-callout">
          ${insights.totalCashOwed.toFixed(2)} owed back to the company from cash jobs
        </p>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [gasLogs, setGasLogs] = useState<GasLog[] | null>(null);

  useEffect(() => {
    api.listJobs().then(setJobs);
    api.listGasLogs().then(setGasLogs);
  }, []);

  const weeklyReports = useMemo(() => computeWeeklyReports(jobs ?? []), [jobs]);

  if (!jobs || !gasLogs) return <p className="loading-text">Loading insights...</p>;

  if (jobs.length === 0 && gasLogs.length === 0) {
    return (
      <div className="empty-state">
        <p>No data yet.</p>
        <p className="empty-hint">Insights will show up once you add a job or log some gas.</p>
      </div>
    );
  }

  const insights: Insights | null = jobs.length > 0 ? computeInsights(jobs) : null;
  const gasInsights: GasInsights = computeGasInsights(gasLogs);

  return (
    <div className="insights">
      {insights && (
        <>
          <div className="stat-grid">
            <StatTile label="Total jobs" value={String(insights.totalJobs)} />
            <StatTile label="Closing rate" value={`${insights.closingRate.toFixed(0)}%`} sub="deposit taken" />
            <StatTile label="Avg ticket" value={formatCompactMoney(insights.avgTicket)} />
            <StatTile label="Total revenue" value={formatCompactMoney(insights.totalRevenue)} />
          </div>

          <Sparkline
            title="Revenue trend"
            caption="Last 6 weeks"
            color="var(--series-1)"
            points={insights.weeklyTrend.map((p) => ({ label: p.label, value: p.revenue }))}
          />

          <ComparisonCard title="This week" caption="vs last week" current={insights.thisWeek} previous={insights.lastWeek} />
          <ComparisonCard title="This month" caption="vs last month" current={insights.thisMonth} previous={insights.lastMonth} />

          <WeeklyReports reports={weeklyReports} />

          <div className="card">
            <div className="card-header">
              <h3>Job status</h3>
            </div>
            <div className="status-summary">
              <div className="status-summary-item">
                <span className="status-dot done" />
                <span>Done</span>
                <strong>{insights.doneCount}</strong>
              </div>
              <div className="status-summary-item">
                <span className="status-dot awaiting" />
                <span>Awaiting</span>
                <strong>{insights.awaitingCount}</strong>
              </div>
            </div>
            {insights.overdueCount > 0 && (
              <p className="overdue-callout">
                {insights.overdueCount} awaiting job{insights.overdueCount > 1 ? "s" : ""} past its scheduled date
              </p>
            )}
          </div>

          <div className="stat-grid">
            <StatTile label="Due this week" value={String(insights.dueThisWeekCount)} sub="awaiting jobs" />
            <StatTile label="Repair team pending" value={String(insights.repairTeamPendingCount)} sub="awaiting jobs" />
          </div>

          <StatTile
            label="Pending payout"
            value={formatMoney(insights.pendingTechProfit)}
            sub="tech profit once these jobs are marked done"
          />

          <TechPayouts insights={insights} />

          <Meter label="Repair team jobs" pct={insights.repairTeamPct} sub="of all jobs" />

          <PaidMethods counts={insights.paidMethodCounts} />

          <StatTile label="Avg payment" value={formatMoney(insights.avgPaid)} sub="among paid jobs" />
        </>
      )}

      {gasLogs.length > 0 && (
        <>
          <StatTile label="Total gas expense" value={formatMoney(gasInsights.totalAllTime)} sub="all time" />
          <GasComparisonCard title="Gas this week" caption="vs last week" current={gasInsights.thisWeek} previous={gasInsights.lastWeek} />
          <GasComparisonCard title="Gas this month" caption="vs last month" current={gasInsights.thisMonth} previous={gasInsights.lastMonth} />
          <Sparkline
            title="Gas trend"
            caption="Last 6 weeks"
            color="var(--series-2)"
            points={gasInsights.weeklyTrend.map((p) => ({ label: p.label, value: p.amount }))}
          />
        </>
      )}
    </div>
  );
}
