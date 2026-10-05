import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { extractCustomerName } from "../customerName";
import { extractAddress } from "../address";
import { extractScheduledTime, parseScheduledStartMinutes } from "../scheduledTime";
import { extractTicketNumber } from "../ticketNumber";
import { geocodeAll, type LatLng } from "../geocode";
import { optimizeStopOrder } from "../routeOptimize";
import { buildGoogleMapsRouteUrl } from "../googleMapsRoute";
import { getCurrentLocation } from "../currentLocation";
import { saveRoute, loadSavedRoute, type SavedRoute } from "../savedRoute";
import { loadReviewTemplate } from "../reviewTemplate";
import {
  ClipboardIcon,
  MapPinIcon,
  CalendarIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  SaveIcon,
  FolderIcon,
  GripIcon,
} from "../components/icons";

// One draggable row in the route. Only the grip handle starts a drag, so the row's own
// buttons stay tappable and the page still scrolls normally when swiping over the content.
function SortableRow({ id, children }: { id: number; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripIcon size={18} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className={`route-stop${isDragging ? " dragging" : ""}`}>
      {children(handle)}
    </div>
  );
}

interface Stop {
  id: number;
  name: string;
  address: string;
  time: string;
  rawText: string;
}

type BuildState = "idle" | "geocoding";

let nextStopId = 1;

export default function RoutePlanPage() {
  const [pastedText, setPastedText] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [noteMessage, setNoteMessage] = useState<string | null>(null);

  // The time-sorted (and, within a tied start time, shortest-travel-sorted) order — fixed
  // once "Calculate route" runs. Stops with no detectable time are handled separately
  // below and merged in wherever the user manually places them.
  const [timedOrder, setTimedOrder] = useState<Stop[] | null>(null);
  const [unscheduledStops, setUnscheduledStops] = useState<Stop[]>([]);
  const [noAddressStops, setNoAddressStops] = useState<Stop[]>([]);
  const [placement, setPlacement] = useState<Record<number, number>>({});
  const [pointById, setPointById] = useState<Record<number, LatLng>>({});
  const [notFoundStopIds, setNotFoundStopIds] = useState<number[]>([]);
  const [expandedStopId, setExpandedStopId] = useState<number | null>(null);

  const [savedRoute, setSavedRoute] = useState<SavedRoute | null>(() => loadSavedRoute());
  const [showSavedRoute, setShowSavedRoute] = useState(false);
  const [savedExpandedStopId, setSavedExpandedStopId] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [copiedTicketId, setCopiedTicketId] = useState<number | null>(null);
  const [copiedNumberId, setCopiedNumberId] = useState<number | null>(null);
  const [savedCopiedTicketId, setSavedCopiedTicketId] = useState<number | null>(null);
  const [savedCopiedNumberId, setSavedCopiedNumberId] = useState<number | null>(null);
  const [copiedReviewTemplate, setCopiedReviewTemplate] = useState(false);

  // Stop ids in the order the user dragged them into — null means "use the app's
  // suggested order". Cleared whenever the route is rebuilt.
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function copyText(text: string, id: number, setCopiedId: (v: number | null) => void) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleCopyReviewTemplate() {
    await navigator.clipboard.writeText(loadReviewTemplate());
    setCopiedReviewTemplate(true);
    setTimeout(() => setCopiedReviewTemplate(false), 1500);
  }

  function resetRoute() {
    setNoteMessage(null);
    setTimedOrder(null);
    setUnscheduledStops([]);
    setNoAddressStops([]);
    setPlacement({});
    setPointById({});
    setNotFoundStopIds([]);
    setManualOrder(null);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPastedText(text);
    } catch {
      alert("Couldn't read the clipboard. Your browser may need permission, or there's nothing copied.");
    }
  }

  // Never stops to ask — whatever the ticket is missing, the stop is added with what was
  // found, and it's flagged (no address) or handled (no time) once the route is built.
  function handleAddStop() {
    setStops((prev) => [
      ...prev,
      {
        id: nextStopId++,
        name: extractCustomerName(pastedText)?.trim() || `Stop ${prev.length + 1}`,
        address: extractAddress(pastedText)?.trim() ?? "",
        time: extractScheduledTime(pastedText)?.trim() ?? "",
        rawText: pastedText.trim(),
      },
    ]);
    setPastedText("");
    resetRoute();
  }

  function handleRemoveStop(id: number) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    resetRoute();
  }

  // Groups routable stops by scheduled start time (ascending), and within each tied group
  // runs our nearest-neighbor + 2-opt pass to minimize driving between them — chained from
  // wherever the route currently is (the tech's live location for the very first group,
  // then the last stop placed so far). A stop whose address our free geocoder can't
  // confirm just keeps its paste-order position within its group instead of blocking
  // anything; Google Maps still finds it fine from the raw address text.
  async function handleCalculateRoute() {
    if (stops.length < 1) return;

    setBuildState("geocoding");
    resetRoute();

    const withAddress = stops.filter((s) => s.address);
    const noAddress = stops.filter((s) => !s.address);
    setNoAddressStops(noAddress);

    if (withAddress.length === 0) {
      setNoteMessage("None of these stops have an address, so there's no route to build.");
      setBuildState("idle");
      return;
    }

    const timed = withAddress.filter((s) => parseScheduledStartMinutes(s.time || null) !== null);
    const unscheduled = withAddress.filter((s) => parseScheduledStartMinutes(s.time || null) === null);
    setUnscheduledStops(unscheduled);

    const groups = new Map<number, Stop[]>();
    for (const s of timed) {
      const minutes = parseScheduledStartMinutes(s.time || null)!;
      const group = groups.get(minutes);
      if (group) group.push(s);
      else groups.set(minutes, [s]);
    }
    const sortedMinutes = [...groups.keys()].sort((a, b) => a - b);

    try {
      let anchor = await getCurrentLocation();
      const finalOrder: Stop[] = [];
      const resolvedPoints: Record<number, LatLng> = {};
      const failedIds: number[] = [];

      for (const minute of sortedMinutes) {
        const group = groups.get(minute)!;
        const points = await geocodeAll(group.map((s) => s.address));

        if (points.every((p): p is LatLng => p !== null)) {
          const order = optimizeStopOrder(points, anchor);
          for (const i of order) {
            finalOrder.push(group[i]);
            resolvedPoints[group[i].id] = points[i];
          }
          anchor = points[order[order.length - 1]];
        } else {
          group.forEach((s, i) => {
            finalOrder.push(s);
            if (points[i]) resolvedPoints[s.id] = points[i]!;
            else failedIds.push(s.id);
          });
          const lastResolved = [...points].reverse().find((p): p is LatLng => p !== null);
          if (lastResolved) anchor = lastResolved;
        }
      }

      setTimedOrder(finalOrder);
      setPointById(resolvedPoints);
      setNotFoundStopIds(failedIds);
      setBuildState("idle");
      if (failedIds.length > 0) {
        setNoteMessage(
          `${failedIds.length} stop${failedIds.length === 1 ? "" : "s"} couldn't be confirmed by our free map lookup, so ${failedIds.length === 1 ? "it" : "they"} may not be in the exact shortest order within its time slot — flagged below. Google Maps will still navigate to ${failedIds.length === 1 ? "it" : "them"} fine from the address text.`
        );
      }
    } catch {
      // Geolocation and geocoding both live behind network calls that can fail outright —
      // the route is still valid sorted purely by time, just without the distance tie-break.
      const flatOrder = sortedMinutes.flatMap((m) => groups.get(m)!);
      setTimedOrder(flatOrder);
      setNotFoundStopIds(flatOrder.map((s) => s.id));
      setNoteMessage(
        "Couldn't look up travel distance between same-time stops, so they're left in a plain order — still sorted by scheduled time."
      );
      setBuildState("idle");
    }
  }

  // Only one route is ever saved — saving again just overwrites it, which is exactly what
  // "start a new route and save it" is supposed to do.
  function handleSaveRoute() {
    if (!routeStops || !mapsUrl) return;
    const route: SavedRoute = {
      savedAt: new Date().toISOString(),
      stops: routeStops.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        time: s.time,
        rawText: s.rawText,
      })),
      mapsUrl,
    };
    saveRoute(route);
    setSavedRoute(route);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  const finalOrder = useMemo(() => {
    if (!timedOrder) return null;
    const buckets: Stop[][] = Array.from({ length: timedOrder.length + 1 }, () => []);
    for (const s of unscheduledStops) {
      const pos = placement[s.id];
      if (pos === undefined) continue;
      buckets[pos].push(s);
    }
    const result: Stop[] = [];
    for (let i = 0; i <= timedOrder.length; i++) {
      result.push(...buckets[i]);
      if (i < timedOrder.length) result.push(timedOrder[i]);
    }
    return result;
  }, [timedOrder, unscheduledStops, placement]);

  // A stop that joins the route after a manual drag (e.g. an unscheduled one just placed)
  // goes in at its suggested position rather than resetting the user's ordering.
  const routeStops = useMemo(() => {
    if (!finalOrder) return null;
    if (!manualOrder) return finalOrder;
    const byId = new Map(finalOrder.map((s) => [s.id, s]));
    const result = manualOrder.map((id) => byId.get(id)).filter((s): s is Stop => s !== undefined);
    finalOrder.forEach((s, i) => {
      if (!manualOrder.includes(s.id)) result.splice(Math.min(i, result.length), 0, s);
    });
    return result;
  }, [finalOrder, manualOrder]);

  const unplacedCount = unscheduledStops.filter((s) => placement[s.id] === undefined).length;

  const mapsUrl = useMemo(() => {
    if (!routeStops || routeStops.length === 0) return null;
    return buildGoogleMapsRouteUrl(routeStops.map((s) => pointById[s.id] ?? s.address));
  }, [routeStops, pointById]);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!routeStops || !over || active.id === over.id) return;
    const ids = routeStops.map((s) => s.id);
    setManualOrder(arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id))));
  }

  function timeLabel(stop: Stop): string {
    return stop.time || "No time found";
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
            <ClipboardIcon size={16} /> Paste from clipboard
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!pastedText.trim()}>
            + Add stop
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
              <span className="empty-hint">
                {stop.address || (
                  <>
                    <AlertTriangleIcon size={13} /> No address found in the ticket
                  </>
                )}
              </span>
              <span className="empty-hint">
                <CalendarIcon size={13} /> {timeLabel(stop)}
              </span>
              <div className="jobs-toolbar" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {stop.address && (
                  <a
                    href={buildGoogleMapsRouteUrl([stop.address])}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                  >
                    <MapPinIcon size={16} /> Navigate to just this stop
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => copyText(stop.rawText, stop.id, setCopiedTicketId)}
                >
                  <ClipboardIcon size={16} /> {copiedTicketId === stop.id ? "Copied!" : "Copy ticket"}
                </button>
                {extractTicketNumber(stop.rawText) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => copyText(extractTicketNumber(stop.rawText)!, stop.id, setCopiedNumberId)}
                  >
                    {copiedNumberId === stop.id ? "Copied!" : `Copy #${extractTicketNumber(stop.rawText)}`}
                  </button>
                )}
              </div>
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
        {buildState === "geocoding" ? (
          "Sorting by time..."
        ) : (
          <>
            <MapPinIcon size={18} /> Calculate route ({stops.length} stop{stops.length === 1 ? "" : "s"})
          </>
        )}
      </button>

      {noteMessage && <p className="empty-hint">{noteMessage}</p>}

      {noAddressStops.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangleIcon size={16} /> No address found
            </h3>
          </div>
          <p className="card-caption">These were left out of the route entirely — nothing to navigate to.</p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {noAddressStops.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </div>
      )}

      {unscheduledStops.length > 0 && timedOrder && (
        <div className="card">
          <div className="card-header">
            <h3>Place these manually</h3>
          </div>
          <p className="card-caption">No scheduled time was found for these — pick where each one fits in the route.</p>
          {unscheduledStops.map((s) => (
            <div key={s.id} className="jobs-toolbar" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1 }}>{s.name}</span>
              <select
                value={placement[s.id] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlacement((prev) => {
                    const next = { ...prev };
                    if (v === "") delete next[s.id];
                    else next[s.id] = Number(v);
                    return next;
                  });
                }}
              >
                <option value="">Choose a spot…</option>
                <option value={0}>At the start</option>
                {timedOrder.map((t, i) => (
                  <option key={t.id} value={i + 1}>
                    After {i + 1}. {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {unplacedCount > 0 && (
            <p className="empty-hint">
              {unplacedCount} stop{unplacedCount === 1 ? "" : "s"} not placed yet — left out of the route below
              until you choose a spot.
            </p>
          )}
        </div>
      )}

      {routeStops && routeStops.length > 0 && mapsUrl && (
        <div className="card">
          <div className="card-header">
            <h3>Route order</h3>
            <span className="card-caption">
              {manualOrder ? "Your custom order" : "Sorted by scheduled time, starts from your location"}
            </span>
          </div>
          <div className="route-reorder-hint">
            <GripIcon size={14} />
            <span>Drag a stop by its handle to change the order.</span>
            {manualOrder && (
              <button type="button" className="btn btn-sm" onClick={() => setManualOrder(null)}>
                Reset order
              </button>
            )}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={routeStops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="route-stops">
            {routeStops.map((stop, i) => {
              const isUnscheduled = unscheduledStops.some((u) => u.id === stop.id);
              const notFound = notFoundStopIds.includes(stop.id);
              const expanded = expandedStopId === stop.id;
              return (
                <SortableRow key={stop.id} id={stop.id}>
                  {(handle) => (
                <>
                  {handle}
                  <div className="route-stop-body">
                  <button
                    type="button"
                    onClick={() => setExpandedStopId(expanded ? null : stop.id)}
                    style={{
                      all: "unset",
                      display: "block",
                      cursor: "pointer",
                      width: "100%",
                    }}
                    aria-expanded={expanded}
                  >
                    <div>
                      <strong>
                        {expanded ? "▾" : "▸"} {i + 1}. {stop.name}
                      </strong>{" "}
                      — <span className="empty-hint">{isUnscheduled ? "manually placed" : timeLabel(stop)}</span>
                    </div>
                  </button>
                  <div className="empty-hint">{stop.address}</div>
                  {notFound && (
                    <p className="overdue-callout" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <AlertTriangleIcon size={15} />
                      <span>
                        Couldn't be found on the free map tool — order isn't guaranteed for this stop, but the
                        "Navigate" link below still sends Google Maps the address directly.
                      </span>
                    </p>
                  )}
                  {expanded && (
                    <p
                      className="empty-hint"
                      style={{
                        whiteSpace: "pre-wrap",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 10,
                        marginTop: 6,
                      }}
                    >
                      {stop.rawText || "No ticket text saved for this stop."}
                    </p>
                  )}
                  <div className="jobs-toolbar" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <a
                      href={buildGoogleMapsRouteUrl([pointById[stop.id] ?? stop.address])}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                    >
                      <MapPinIcon size={16} /> Navigate to just this stop
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => copyText(stop.rawText, stop.id, setCopiedTicketId)}
                    >
                      <ClipboardIcon size={16} /> {copiedTicketId === stop.id ? "Copied!" : "Copy ticket"}
                    </button>
                    {extractTicketNumber(stop.rawText) && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => copyText(extractTicketNumber(stop.rawText)!, stop.id, setCopiedNumberId)}
                      >
                        {copiedNumberId === stop.id ? "Copied!" : `Copy #${extractTicketNumber(stop.rawText)}`}
                      </button>
                    )}
                  </div>
                  </div>
                </>
                  )}
                </SortableRow>
              );
            })}
          </div>
            </SortableContext>
          </DndContext>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
            <MapPinIcon size={16} /> Open full route in Google Maps
          </a>
          <button type="button" className="btn btn-block" onClick={handleSaveRoute}>
            {justSaved ? (
              <>
                <CheckCircleIcon size={16} /> Saved!
              </>
            ) : (
              <>
                <SaveIcon size={16} /> Save this route
              </>
            )}
          </button>
        </div>
      )}

      <div className="jobs-toolbar" style={{ flexDirection: "row" }}>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          disabled={!savedRoute}
          onClick={() => setShowSavedRoute((prev) => !prev)}
        >
          {showSavedRoute ? (
            "Hide saved route"
          ) : (
            <>
              <FolderIcon size={16} /> Show saved route
            </>
          )}
        </button>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={handleCopyReviewTemplate}>
          <ClipboardIcon size={16} /> {copiedReviewTemplate ? "Copied!" : "Copy review template"}
        </button>
      </div>

      {showSavedRoute && savedRoute && (
        <div className="card">
          <div className="card-header">
            <h3>Saved route</h3>
            <span className="card-caption">Saved {new Date(savedRoute.savedAt).toLocaleString()}</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 8 }}>
            {savedRoute.stops.map((stop, i) => {
              const expanded = savedExpandedStopId === stop.id;
              return (
                <li key={stop.id}>
                  <button
                    type="button"
                    onClick={() => setSavedExpandedStopId(expanded ? null : stop.id)}
                    style={{ all: "unset", display: "block", cursor: "pointer", width: "100%" }}
                    aria-expanded={expanded}
                  >
                    <div>
                      <strong>
                        {expanded ? "▾" : "▸"} {i + 1}. {stop.name}
                      </strong>{" "}
                      — <span className="empty-hint">{stop.time || "No time found"}</span>
                    </div>
                  </button>
                  <div className="empty-hint">{stop.address}</div>
                  {expanded && (
                    <p
                      className="empty-hint"
                      style={{
                        whiteSpace: "pre-wrap",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 10,
                        marginTop: 6,
                      }}
                    >
                      {stop.rawText || "No ticket text saved for this stop."}
                    </p>
                  )}
                  <div className="jobs-toolbar" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <a
                      href={buildGoogleMapsRouteUrl([stop.address])}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                    >
                      <MapPinIcon size={16} /> Navigate to just this stop
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => copyText(stop.rawText, stop.id, setSavedCopiedTicketId)}
                    >
                      <ClipboardIcon size={16} /> {savedCopiedTicketId === stop.id ? "Copied!" : "Copy ticket"}
                    </button>
                    {extractTicketNumber(stop.rawText) && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => copyText(extractTicketNumber(stop.rawText)!, stop.id, setSavedCopiedNumberId)}
                      >
                        {savedCopiedNumberId === stop.id ? "Copied!" : `Copy #${extractTicketNumber(stop.rawText)}`}
                      </button>
                    )}
                  </div>
                  <div style={{ height: 6 }} />
                </li>
              );
            })}
          </ol>
          <a href={savedRoute.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
            <MapPinIcon size={16} /> Open saved route in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
