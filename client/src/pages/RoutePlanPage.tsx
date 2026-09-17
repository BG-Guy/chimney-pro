import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Job } from "../types";
import { extractCustomerName } from "../customerName";
import { extractAddress } from "../address";
import { geocodeAll } from "../geocode";
import { optimizeStopOrder } from "../routeOptimize";
import { buildGoogleMapsRouteUrl } from "../googleMapsRoute";

type BuildState = "idle" | "geocoding" | "error";

export default function RoutePlanPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<{ name: string; address: string }[] | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  const routableJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.status === "awaiting")
        .map((job) => ({
          job,
          name: extractCustomerName(job.rawTicketText) || `Job #${job.id}`,
          address: extractAddress(job.rawTicketText),
        }))
        .filter((entry) => entry.address !== null) as { job: Job; name: string; address: string }[],
    [jobs]
  );

  function toggleSelected(id: number) {
    setOrderedStops(null);
    setMapsUrl(null);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBuildRoute() {
    const selected = routableJobs.filter((entry) => selectedIds.includes(entry.job.id!));
    if (selected.length < 2) return;

    setBuildState("geocoding");
    setErrorMessage(null);
    setOrderedStops(null);
    setMapsUrl(null);

    try {
      const points = await geocodeAll(selected.map((entry) => entry.address));
      const missing = selected.filter((_, i) => !points[i]);
      if (missing.length > 0) {
        setErrorMessage(`Couldn't locate: ${missing.map((entry) => entry.name).join(", ")}`);
        setBuildState("error");
        return;
      }

      const validPoints = points as NonNullable<(typeof points)[number]>[];
      const order = optimizeStopOrder(validPoints);
      const stops = order.map((i) => ({ name: selected[i].name, address: selected[i].address }));

      setOrderedStops(stops);
      setMapsUrl(buildGoogleMapsRouteUrl(stops.map((s) => s.address)));
      setBuildState("idle");
    } catch {
      setErrorMessage("Something went wrong looking up those addresses. Try again.");
      setBuildState("error");
    }
  }

  if (loading) return <p className="loading-text">Loading jobs...</p>;

  if (routableJobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No awaiting jobs with a recognizable address yet.</p>
        <p className="empty-hint">
          Addresses are picked up automatically from the pasted job text — make sure the street, city,
          state, and zip are on their own line.
        </p>
      </div>
    );
  }

  return (
    <div className="job-list">
      <p className="empty-hint">Pick the stops for today's run, then build a route.</p>

      <div className="job-cards">
        {routableJobs.map(({ job, name, address }) => (
          <label key={job.id} className="job-card checkbox-label" style={{ flexDirection: "row" }}>
            <input
              type="checkbox"
              checked={selectedIds.includes(job.id!)}
              onChange={() => toggleSelected(job.id!)}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{name}</strong>
              <span className="empty-hint">{address}</span>
              {job.scheduledDate && <span className="empty-hint">Scheduled {job.scheduledDate}</span>}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={selectedIds.length < 2 || buildState === "geocoding"}
        onClick={handleBuildRoute}
      >
        {buildState === "geocoding"
          ? "Looking up addresses..."
          : `🧭 Build route (${selectedIds.length} stop${selectedIds.length === 1 ? "" : "s"})`}
      </button>

      {errorMessage && <p className="empty-hint">{errorMessage}</p>}

      {orderedStops && mapsUrl && (
        <div className="card">
          <div className="card-header">
            <h3>Suggested order</h3>
          </div>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            {orderedStops.map((stop, i) => (
              <li key={i}>
                <strong>{stop.name}</strong> — <span className="empty-hint">{stop.address}</span>
              </li>
            ))}
          </ol>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
            📍 Open route in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
