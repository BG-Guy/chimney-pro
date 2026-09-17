import { useState } from "react";
import { extractCustomerName } from "../customerName";
import { extractAddress } from "../address";
import { extractScheduledTime } from "../scheduledTime";
import { geocodeAll } from "../geocode";
import { optimizeStopOrder } from "../routeOptimize";
import { buildGoogleMapsRouteUrl } from "../googleMapsRoute";
import { getCurrentLocation } from "../currentLocation";

interface Stop {
  id: number;
  name: string;
  address: string;
  time: string;
}

interface Draft {
  name: string;
  address: string;
  time: string;
  missingName: boolean;
  missingAddress: boolean;
  missingTime: boolean;
}

type BuildState = "idle" | "geocoding" | "error";

let nextStopId = 1;

export default function RoutePlanPage() {
  const [pastedText, setPastedText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedStopIds, setFailedStopIds] = useState<number[]>([]);
  const [orderedStops, setOrderedStops] = useState<Stop[] | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  function resetRoute() {
    setOrderedStops(null);
    setMapsUrl(null);
    setErrorMessage(null);
    setFailedStopIds([]);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPastedText(text);
    } catch {
      alert("Couldn't read the clipboard. Your browser may need permission, or there's nothing copied.");
    }
  }

  function commitStop(name: string, address: string, time: string) {
    setStops((prev) => [
      ...prev,
      { id: nextStopId++, name: name.trim() || `Stop ${prev.length + 1}`, address: address.trim(), time: time.trim() },
    ]);
    setPastedText("");
    setDraft(null);
    setDraftError(null);
    resetRoute();
  }

  function handleAddStop() {
    const address = extractAddress(pastedText);
    const name = extractCustomerName(pastedText);
    const time = extractScheduledTime(pastedText);

    if (!address || !name || !time) {
      setDraft({
        name: name ?? "",
        address: address ?? "",
        time: time ?? "",
        missingName: !name,
        missingAddress: !address,
        missingTime: !time,
      });
      setDraftError(null);
      return;
    }

    commitStop(name, address, time);
  }

  function handleConfirmDraft() {
    if (!draft) return;
    if (!draft.address.trim()) {
      setDraftError("An address is required — the route can't be built without one.");
      return;
    }
    commitStop(draft.name, draft.address, draft.time);
  }

  function handleCancelDraft() {
    setDraft(null);
    setDraftError(null);
  }

  function handleRemoveStop(id: number) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    resetRoute();
  }

  async function handleCalculateRoute() {
    if (stops.length < 1) return;

    setBuildState("geocoding");
    setErrorMessage(null);
    setFailedStopIds([]);
    setOrderedStops(null);
    setMapsUrl(null);

    try {
      // The anchor only steers which stop order we suggest — the link itself always
      // starts from wherever the device actually is when it's opened, resolved live by
      // Google Maps, regardless of whether this lookup succeeds.
      const [anchor, points] = await Promise.all([
        getCurrentLocation(),
        geocodeAll(stops.map((s) => s.address)),
      ]);
      const missing = stops.filter((_, i) => !points[i]);
      if (missing.length > 0) {
        setFailedStopIds(missing.map((s) => s.id));
        setErrorMessage(
          `Couldn't find a map location for ${missing.length === 1 ? "this address" : "these addresses"}: ${missing
            .map((s) => `"${s.address}"`)
            .join(", ")}. Double-check the street number, city, state, and 5-digit zip are correct and spelled right — the flagged stop(s) below can be removed and re-added with the fix.`
        );
        setBuildState("error");
        return;
      }

      const validPoints = points as NonNullable<(typeof points)[number]>[];
      const order = optimizeStopOrder(validPoints, anchor);
      const ordered = order.map((i) => stops[i]);

      setOrderedStops(ordered);
      setMapsUrl(buildGoogleMapsRouteUrl(ordered.map((s) => s.address)));
      setBuildState("idle");
    } catch {
      setErrorMessage("Something went wrong looking up those addresses. Try again.");
      setBuildState("error");
    }
  }

  return (
    <div className="job-list">
      <p className="empty-hint">Paste a job ticket, click Add, and repeat for each stop.</p>

      {draft ? (
        <div className="card job-form">
          <div className="card-header">
            <h3>Fill in the missing details</h3>
          </div>
          <p className="card-caption">
            Couldn't automatically detect the{" "}
            {[draft.missingName && "name", draft.missingAddress && "address", draft.missingTime && "date/time"]
              .filter(Boolean)
              .join(", ")}{" "}
            from that text — fill it in below.
          </p>
          <label>
            Customer name
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Scott Davis"
            />
          </label>
          <label>
            Address
            <input
              type="text"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              placeholder="Street, City, State ZIP"
            />
          </label>
          <label>
            Scheduled date/time
            <input
              type="text"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              placeholder="e.g. September 20, 2026, 2:00 pm"
            />
          </label>
          {draftError && <p className="empty-hint">{draftError}</p>}
          <div className="jobs-toolbar" style={{ flexDirection: "row" }}>
            <button type="button" className="btn btn-sm" onClick={handleCancelDraft}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmDraft}>
              ✅ Confirm & add stop
            </button>
          </div>
        </div>
      ) : (
        <form
          className="job-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddStop();
          }}
        >
          <label>
            Paste job ticket
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the raw job ticket text here..."
            />
          </label>
          <div className="jobs-toolbar" style={{ flexDirection: "row" }}>
            <button type="button" className="btn btn-sm" onClick={handlePasteFromClipboard}>
              📋 Paste from clipboard
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!pastedText.trim()}>
              ➕ Add stop
            </button>
          </div>
        </form>
      )}

      {stops.length > 0 && (
        <div className="job-cards">
          {stops.map((stop, i) => {
            const failed = failedStopIds.includes(stop.id);
            return (
              <div
                className="job-card"
                key={stop.id}
                style={failed ? { borderColor: "var(--critical)" } : undefined}
              >
                <div className="job-card-top">
                  <strong>
                    {i + 1}. {stop.name}
                  </strong>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveStop(stop.id)}>
                    Remove
                  </button>
                </div>
                <span className="empty-hint">{stop.address}</span>
                {stop.time && <span className="empty-hint">📅 {stop.time}</span>}
                {failed && <p className="overdue-callout">⚠️ Couldn't find this address on the map — check it's correct.</p>}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={stops.length < 1 || buildState === "geocoding"}
        onClick={handleCalculateRoute}
      >
        {buildState === "geocoding"
          ? "Looking up addresses..."
          : `🧭 Calculate route (${stops.length} stop${stops.length === 1 ? "" : "s"})`}
      </button>

      {errorMessage && <p className="empty-hint">{errorMessage}</p>}

      {orderedStops && mapsUrl && (
        <div className="card">
          <div className="card-header">
            <h3>Suggested order</h3>
            <span className="card-caption">Starts from your location</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            {orderedStops.map((stop) => (
              <li key={stop.id}>
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
