import { useState } from "react";
import { extractCustomerName } from "../customerName";
import { extractAddress } from "../address";
import { geocodeAll } from "../geocode";
import { optimizeStopOrder } from "../routeOptimize";
import { buildGoogleMapsRouteUrl } from "../googleMapsRoute";
import { getCurrentLocation } from "../currentLocation";

interface Stop {
  id: number;
  name: string;
  address: string;
}

type BuildState = "idle" | "geocoding" | "error";

let nextStopId = 1;

export default function RoutePlanPage() {
  const [pastedText, setPastedText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<Stop[] | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  function resetRoute() {
    setOrderedStops(null);
    setMapsUrl(null);
    setErrorMessage(null);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPastedText(text);
    } catch {
      alert("Couldn't read the clipboard. Your browser may need permission, or there's nothing copied.");
    }
  }

  function handleAddStop() {
    const address = extractAddress(pastedText);
    if (!address) {
      setParseError("Couldn't find an address in that text — make sure the street, city, state, and zip are on their own line.");
      return;
    }
    const name = extractCustomerName(pastedText) || `Stop ${stops.length + 1}`;
    setStops((prev) => [...prev, { id: nextStopId++, name, address }]);
    setPastedText("");
    setParseError(null);
    resetRoute();
  }

  function handleRemoveStop(id: number) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    resetRoute();
  }

  async function handleCalculateRoute() {
    if (stops.length < 1) return;

    setBuildState("geocoding");
    setErrorMessage(null);
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
        setErrorMessage(`Couldn't locate: ${missing.map((s) => s.name).join(", ")}`);
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
            onChange={(e) => {
              setPastedText(e.target.value);
              setParseError(null);
            }}
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
        {parseError && <p className="empty-hint">{parseError}</p>}
      </form>

      {stops.length > 0 && (
        <div className="job-cards">
          {stops.map((stop, i) => (
            <div className="job-card" key={stop.id}>
              <div className="job-card-top">
                <strong>
                  {i + 1}. {stop.name}
                </strong>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveStop(stop.id)}>
                  Remove
                </button>
              </div>
              <span className="empty-hint">{stop.address}</span>
            </div>
          ))}
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
