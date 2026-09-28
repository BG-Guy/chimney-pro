import { useState } from "react";
import { extractCustomerName } from "../customerName";
import { extractAddress, zipAndStateOnly } from "../address";
import { extractScheduledTime } from "../scheduledTime";
import { geocodeAll, type LatLng } from "../geocode";
import { optimizeStopOrder } from "../routeOptimize";
import { buildGoogleMapsRouteUrl, buildGoogleMapsRouteUrlFromAddresses } from "../googleMapsRoute";
import { getCurrentLocation } from "../currentLocation";

interface Stop {
  id: number;
  name: string;
  address: string;
  time: string;
}

// A stop whose address couldn't be found automatically. `tempAddress` is the rough
// "State ZIP" stand-in used in its place, or null when even that couldn't be worked out.
interface UnfoundStop {
  id: number;
  name: string;
  address: string;
  tempAddress: string | null;
}

type BuildState = "idle" | "geocoding";

let nextStopId = 1;

export default function RoutePlanPage() {
  const [pastedText, setPastedText] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<Stop[] | null>(null);
  const [orderIsFinal, setOrderIsFinal] = useState(false);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const [unfoundStops, setUnfoundStops] = useState<UnfoundStop[]>([]);

  function resetRoute() {
    setOrderedStops(null);
    setMapsUrl(null);
    setNoteMessage(null);
    setOrderIsFinal(false);
    setUnfoundStops([]);
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
    resetRoute();
  }

  // Never stops to ask — whatever the ticket is missing, the stop is added with what was
  // found. A stop with no address is left out of the route and flagged when it's built.
  function handleAddStop() {
    commitStop(
      extractCustomerName(pastedText) ?? "",
      extractAddress(pastedText) ?? "",
      extractScheduledTime(pastedText) ?? ""
    );
  }

  function handleRemoveStop(id: number) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    resetRoute();
  }

  // Our own geocoder (OpenStreetMap/Nominatim) is what lets us work out the visiting order
  // before opening Maps, but it's a free best-effort service that regularly can't resolve a
  // real address (postal city names like "Harleysville" often don't match OpenStreetMap's
  // official township/borough names). Rather than stop and ask, any address it can't find
  // is swapped for a temporary "State ZIP" stand-in — close enough to order the route — and
  // the user is told which customers to fix up in Google Maps afterwards.
  async function handleCalculateRoute() {
    if (stops.length < 1) return;

    setBuildState("geocoding");
    resetRoute();

    const routable = stops.filter((s) => s.address);
    const noAddress: UnfoundStop[] = stops
      .filter((s) => !s.address)
      .map((s) => ({ id: s.id, name: s.name, address: "", tempAddress: null }));
    if (routable.length === 0) {
      setNoteMessage("None of the stops have an address, so there's no route to build.");
      setUnfoundStops(noAddress);
      setBuildState("idle");
      return;
    }

    // Last resort, when even the ZIP stand-ins can't be placed: hand Google Maps the raw
    // addresses and let it pick the order itself.
    function fallBackToGoogle(note: string, unfound: UnfoundStop[] = []) {
      setOrderedStops(routable);
      setOrderIsFinal(false);
      setMapsUrl(buildGoogleMapsRouteUrlFromAddresses(routable.map((s) => s.address)));
      setNoteMessage(note);
      setUnfoundStops([...unfound, ...noAddress]);
      setBuildState("idle");
    }

    try {
      // The anchor only steers which stop order we suggest — the link itself always
      // starts from wherever the device actually is when it's opened, resolved live by
      // Google Maps, regardless of whether this lookup succeeds.
      const [anchor, points] = await Promise.all([
        getCurrentLocation(),
        geocodeAll(routable.map((s) => s.address)),
      ]);

      const unfound: UnfoundStop[] = routable
        .filter((_, i) => !points[i])
        .map((s) => ({ id: s.id, name: s.name, address: s.address, tempAddress: zipAndStateOnly(s.address) }));
      const withTemp = unfound.filter((u) => u.tempAddress);
      const tempPoints = await geocodeAll(withTemp.map((u) => u.tempAddress!));
      const tempPointById = new Map(withTemp.map((u, i) => [u.id, tempPoints[i]]));

      const allPoints = routable.map((s, i) => points[i] ?? tempPointById.get(s.id) ?? null);
      if (allPoints.some((p) => !p)) {
        fallBackToGoogle(
          "Some addresses couldn't be found automatically, even by ZIP code, so Google Maps will look them up and pick the order itself when you open the link below.",
          unfound.map((u) => ({ ...u, tempAddress: null }))
        );
        return;
      }

      const validPoints = allPoints as LatLng[];
      const order = optimizeStopOrder(validPoints, anchor);
      const ordered = order.map((i) => routable[i]);
      const tempAddressById = new Map(unfound.map((u) => [u.id, u.tempAddress!]));

      setOrderedStops(ordered);
      setOrderIsFinal(true);
      setMapsUrl(buildGoogleMapsRouteUrl(order.map((i) => tempAddressById.get(routable[i].id) ?? validPoints[i])));
      setUnfoundStops([...unfound, ...noAddress]);
      setBuildState("idle");
    } catch {
      fallBackToGoogle(
        "Couldn't work out the order locally, so Google Maps will look up addresses and pick the order itself when you open the link below."
      );
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
              <span className="empty-hint">{stop.address || "⚠️ No address found in the ticket"}</span>
              {stop.time && <span className="empty-hint">📅 {stop.time}</span>}
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

      {noteMessage && <p className="empty-hint">{noteMessage}</p>}

      {unfoundStops.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>⚠️ Addresses not found</h3>
          </div>
          <p className="card-caption">
            {orderIsFinal
              ? "These couldn't be found automatically. Where there was a ZIP code, a temporary address (state and ZIP only) was used instead, so the order is a rough guide — fix these stops in Google Maps."
              : "These couldn't be found automatically — check these stops in Google Maps."}
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            {unfoundStops.map((u) => (
              <li key={u.id}>
                <strong>{u.name}</strong> —{" "}
                <span className="empty-hint">{u.address || "no address in the ticket, left out of the route"}</span>
                {u.tempAddress && <span className="empty-hint"> (temporarily: {u.tempAddress})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {orderedStops && mapsUrl && (
        <div className="card">
          <div className="card-header">
            <h3>{orderIsFinal ? "Suggested order" : "Stops"}</h3>
            <span className="card-caption">
              {orderIsFinal ? "Starts from your location" : "Order picked by Google Maps when opened"}
            </span>
          </div>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            {orderedStops.map((stop) => {
              const unfound = unfoundStops.find((u) => u.id === stop.id);
              return (
                <li key={stop.id}>
                  <strong>{stop.name}</strong> — <span className="empty-hint">{stop.address}</span>
                  {unfound && <span className="empty-hint"> ⚠️ not found{unfound.tempAddress && `, using ${unfound.tempAddress}`}</span>}
                </li>
              );
            })}
          </ol>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
            📍 Open route in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
