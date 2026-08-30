import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { computeInsights, computePeriodMetrics, type Insights, type PeriodMetrics } from "../insights";
import { computeGasInsights, type GasInsights } from "../gasInsights";
import { buildWeeklyReport, downloadWeeklyReportCsv } from "../weeklyReports";
import {
  currentMonthOption,
  currentWeekOfMonthN,
  recentMonths,
  weeksOfMonth,
  type MonthOption,
} from "../dateBuckets";
import { addDays, computeDateRanges, fmtISO } from "../dateUtils";
import MonthWeekPicker from "../components/MonthWeekPicker";
import { DEPOSIT_METHOD_EMOJI, type GasLog, type Job } from "../types";
import { formatCompactMoney, formatMoney } from "../format";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function MetricRow({ label, previous, current }: { label: string; previous: string; current: string }) {
  return (
    <div className="metric-row">
      <span className="metric-row-label">{label}</span>
      <span className="metric-row-previous">{previous}</span>
      <span className="metric-row-arrow">→</span>
      <span className="metric-row-current">{current}</span>
    </div>
  );
}

function PeriodComparisonCard({
  title,
  previousLabel,
  currentLabel,
  current,
  previous,
}: {
  title: string;
  previousLabel: string;
  currentLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="metric-row metric-row-header">
        <span className="metric-row-label" />
        <span className="metric-row-previous">{previousLabel}</span>
        <span className="metric-row-arrow" />
        <span className="metric-row-current">{currentLabel}</span>
      </div>
      <div className="metric-rows">
        <MetricRow label="Jobs" previous={String(previous.jobCount)} current={String(current.jobCount)} />
        <MetricRow
          label="Revenue"
          previous={formatCompactMoney(previous.revenue)}
          current={formatCompactMoney(current.revenue)}
        />
        <MetricRow
          label="Parts cost"
          previous={formatCompactMoney(previous.partsCost)}
          current={formatCompactMoney(current.partsCost)}
        />
        <MetricRow
          label="Tech profit"
          previous={formatCompactMoney(previous.techProfitRealized)}
          current={formatCompactMoney(current.techProfitRealized)}
        />
        <MetricRow
          label="Tech profit awaiting"
          previous={formatCompactMoney(previous.techProfitAwaiting)}
          current={formatCompactMoney(current.techProfitAwaiting)}
        />
        <MetricRow
          label="Avg ticket"
          previous={formatCompactMoney(previous.avgTicket)}
          current={formatCompactMoney(current.avgTicket)}
        />
        <MetricRow
          label="Closing rate"
          previous={`${previous.closingRate.toFixed(0)}%`}
          current={`${current.closingRate.toFixed(0)}%`}
        />
        <MetricRow
          label="Repair team jobs"
          previous={String(previous.repairTeamCount)}
          current={String(current.repairTeamCount)}
        />
        <MetricRow
          label="Gas expense"
          previous={formatCompactMoney(previous.gasExpense)}
          current={formatCompactMoney(current.gasExpense)}
        />
        <MetricRow
          label="Cash collected"
          previous={formatCompactMoney(previous.cashCollected)}
          current={formatCompactMoney(current.cashCollected)}
        />
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

function defaultWeekNFor(m: MonthOption): number {
  const real = currentMonthOption();
  if (m.year === real.year && m.month === real.month) return currentWeekOfMonthN(m.year, m.month);
  const w = weeksOfMonth(m.year, m.month);
  return w[w.length - 1]?.n ?? 1;
}

function QuickInsightsReport({ jobs, gasLogs }: { jobs: Job[]; gasLogs: GasLog[] }) {
  const months = useMemo(() => recentMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState<MonthOption>(() => currentMonthOption());
  const [selectedWeekN, setSelectedWeekN] = useState<number>(() => defaultWeekNFor(currentMonthOption()));
  const weeks = useMemo(() => weeksOfMonth(selectedMonth.year, selectedMonth.month), [selectedMonth]);

  function handleSelectMonth(m: MonthOption) {
    setSelectedMonth(m);
    setSelectedWeekN(defaultWeekNFor(m));
  }

  const activeWeek = weeks.find((w) => w.n === selectedWeekN) ?? weeks[weeks.length - 1];
  const report = useMemo(
    () =>
      activeWeek
        ? buildWeeklyReport(jobs, gasLogs, activeWeek.weekStart, `${selectedMonth.label} · ${activeWeek.label}`)
        : null,
    [jobs, gasLogs, activeWeek, selectedMonth]
  );

  return (
    <div className="card">
      <div className="card-header">
        <h3>Quick insights report</h3>
      </div>

      <MonthWeekPicker
        months={months}
        selectedMonth={selectedMonth}
        onSelectMonth={handleSelectMonth}
        weeks={weeks}
        selectedWeekN={selectedWeekN}
        onSelectWeekN={setSelectedWeekN}
      />

      {report && (
        <>
          <p className="card-caption">{report.dateRange}</p>

          <div className="stat-grid">
            <StatTile label="Jobs" value={String(report.metrics.jobCount)} />
            <StatTile label="Revenue" value={formatCompactMoney(report.metrics.revenue)} />
            <StatTile label="Parts cost" value={formatCompactMoney(report.metrics.partsCost)} />
            <StatTile label="Tech profit" value={formatCompactMoney(report.metrics.techProfitRealized)} />
            <StatTile label="Tech profit awaiting" value={formatCompactMoney(report.metrics.techProfitAwaiting)} />
            <StatTile label="Avg ticket" value={formatCompactMoney(report.metrics.avgTicket)} />
            <StatTile label="Closing rate" value={`${report.metrics.closingRate.toFixed(0)}%`} />
            <StatTile label="Repair team jobs" value={String(report.metrics.repairTeamCount)} />
            <StatTile label="Gas expense" value={formatCompactMoney(report.metrics.gasExpense)} />
            <StatTile label="Cash collected" value={formatCompactMoney(report.metrics.cashCollected)} />
          </div>

          {report.jobs.length === 0 ? (
            <p className="empty-hint">No jobs scheduled this week.</p>
          ) : (
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
          )}

          <button type="button" className="btn" onClick={() => downloadWeeklyReportCsv(report)}>
            ⬇️ Export CSV
          </button>
        </>
      )}
    </div>
  );
}

function TechPayouts({ insights }: { insights: Insights }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Tech payouts</h3>
        <span className="card-caption">done & paid off, 25% after parts</span>
      </div>
      <div className="comparison-row">
        <div className="comparison-metric">
          <span className="comparison-label">Tech profit (total)</span>
          <span className="comparison-value">{formatMoney(insights.totalTechProfit)}</span>
        </div>
        <div className="comparison-metric">
          <span className="comparison-label">Cash collected (total)</span>
          <span className="comparison-value">{formatMoney(insights.totalCashCollected)}</span>
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

  const periodMetrics = useMemo(() => {
    const j = jobs ?? [];
    const g = gasLogs ?? [];
    const { todayStr, weekStart, weekEnd, lastWeekStart, lastWeekEnd, monthStart, monthEnd, lastMonthStart, lastMonthEnd } =
      computeDateRanges();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterdayStr = fmtISO(addDays(today, -1));
    return {
      today: computePeriodMetrics(j, g, todayStr, todayStr),
      yesterday: computePeriodMetrics(j, g, yesterdayStr, yesterdayStr),
      thisWeek: computePeriodMetrics(j, g, fmtISO(weekStart), fmtISO(weekEnd)),
      lastWeek: computePeriodMetrics(j, g, fmtISO(lastWeekStart), fmtISO(lastWeekEnd)),
      thisMonth: computePeriodMetrics(j, g, fmtISO(monthStart), fmtISO(monthEnd)),
      lastMonth: computePeriodMetrics(j, g, fmtISO(lastMonthStart), fmtISO(lastMonthEnd)),
    };
  }, [jobs, gasLogs]);

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
      <PeriodComparisonCard
        title="Today"
        previousLabel="Yesterday"
        currentLabel="Today"
        current={periodMetrics.today}
        previous={periodMetrics.yesterday}
      />

      <PeriodComparisonCard
        title="This week"
        previousLabel="Last week"
        currentLabel="This week"
        current={periodMetrics.thisWeek}
        previous={periodMetrics.lastWeek}
      />
      <PeriodComparisonCard
        title="This month"
        previousLabel="Last month"
        currentLabel="This month"
        current={periodMetrics.thisMonth}
        previous={periodMetrics.lastMonth}
      />

      <QuickInsightsReport jobs={jobs} gasLogs={gasLogs} />

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
