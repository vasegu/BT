import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Household, NetworkView, PersonId, Snapshot, SourceEvent } from "./types";
import { householdNames } from "./presentation";
import { FocusHeader } from "./FocusHeader";
import { LiveNotNightly, RouterTelemetry, Provisioning, Households } from "./OperationsPanels";
import "./operations-view.css";

// Operational memory, expanded. One question: what is operations telling the system?
// The feeds that report in, the raw signals as they arrive, and the operational context
// the system builds from them — which is what the arbiter reads.
const HOUR = 3600e3;
const at = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const ago = (ms: number) => (ms < 60e3 ? "just now" : ms < HOUR ? `${Math.round(ms / 60e3)}m ago` : `${Math.round(ms / HOUR)}h ago`);
const tint: Record<PersonId, string> = { daniel: "#5514b4", sam: "#0f7b5f", maya: "#a15c07" };

const FEEDS = [
  { source: "router_simulator", name: "Router telemetry", cadence: "4-hour windows per router, plus overdue / back alerts", color: "#5514b4" },
  { source: "network_simulator", name: "Network operations", cadence: "incident register · on change", color: "#c2416b" },
  { source: "diagnostics_simulator", name: "Line diagnostics", cadence: "tests run on a line · on demand", color: "#2a78d6" },
  { source: "workforce_simulator", name: "Workforce", cadence: "callback rota · on change", color: "#0f7b5f" },
  { source: "orders_simulator", name: "Orders & provisioning", cadence: "order and activation states · on change", color: "#a15c07" },
] as const;
const feedOf = (source: string) => FEEDS.find((f) => f.source === source);

/** What each signal changed in the system's operational picture, in one line. */
function effect(e: SourceEvent, snapshot: Snapshot): string {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "router.observation_window": {
      const got = Number(p.received),
        exp = Number(p.expected);
      return p.coverage === "no_telemetry" ? "No heartbeat at all in this window" : got >= exp * 0.95 ? `Steady · ${got}/${exp} heartbeats` : `Gap · ${got}/${exp} heartbeats`;
    }
    case "router.overnight_window":
      return p.returnObserved ? `Overnight quiet ended at ${at(String(p.returnAt))}` : "Overnight quiet, return not yet observed";
    case "router.heartbeat_overdue":
      return "Router quiet · cause unknown";
    case "router.heartbeat_received":
      return "Router heard from again";
    case "incident.confirmed": {
      const inc = snapshot.operations.incident;
      const out = (["daniel", "sam", "maya"] as PersonId[]).filter((x) => !inc?.affected.includes(x));
      return `Incident register: ${inc?.affected.map((x) => householdNames[x].split(" ")[0]).join(", ") || "none"} in scope${out.length ? `; ${out.map((x) => householdNames[x].split(" ")[0]).join(", ")} outside` : ""}`;
    }
    case "capacity.recorded":
      return `Rota: ${snapshot.operations.slots.map((s) => `${s.time} ${s.owner ? `held (${s.owner})` : "free"}`).join(" · ")}`;
    case "diagnostic.completed":
      return `Test result: ${String(p.result ?? "recorded").replace("_", " ")}`;
    case "service.restored_observed":
      return "Line test passed · restoration observed";
    case "activation.confirmed":
      return "Provisioning confirmed";
    case "activation.first_use_observed":
      return "First successful use observed";
    default:
      return e.description;
  }
}

export function OperationsView({
  h,
  snapshot,
  inspect,
  onCutoff,
  onPerson,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  onCutoff: (at: number) => void;
  onPerson: (p: PersonId) => void;
}) {
  const [feed, setFeed] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const clock = Date.parse(snapshot.clock);
  const since = clock - 24 * HOUR;
  const ops = snapshot.events.filter((e) => feedOf(e.source) && Date.parse(e.receivedAt) <= clock);
  const recent = ops.filter((e) => Date.parse(e.receivedAt) > since);
  const stream = recent
    .filter((e) => (!feed || e.source === feed) && (!onlyMine || e.subject === h.id || e.subject === "shared"))
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  const net = snapshot.operations.network;
  return (
    <div className="av ov">
      <FocusHeader
        panel="Operational memory"
        question="What is operations telling the system?"
        snapshot={snapshot}
        person={h.id}
        stat={{ value: recent.length, label: "signals in 24h" }}
        onPerson={onPerson}
        onCutoff={onCutoff}
        moments={false}
      />
      <section className="av-step ov-context">
        <header>
          <span>01</span>
          <h3>Operational context now</h3>
        </header>
        <p className="av-note">What the feeds add up to. This is the shared picture the arbiter reads for every household.</p>
        {net ? (
          <WestLondonMap net={net} snapshot={snapshot} focus={h.id} onPerson={onPerson} />
        ) : (
          <p className="av-note">This data store does not hold the operational tables. Switch to the Supabase runtime.</p>
        )}
      </section>
      <section className="av-step ov-feeds">
        <header>
          <span>02</span>
          <h3>Operational feeds</h3>
          <small className="ov-hint">Arrivals over the last 24 hours · the band is tonight</small>
        </header>
        <div className="ov-feed-axis" aria-hidden="true">
          <span />
          <span className="ov-axis-labels">
            {[24, 18, 12, 6, 0].map((hAgo) => (
              <span key={hAgo} style={{ left: `${((24 - hAgo) / 24) * 100}%` }}>
                {hAgo ? at(new Date(clock - hAgo * HOUR).toISOString()) : "now"}
              </span>
            ))}
          </span>
          <span />
        </div>
        {FEEDS.map((f) => {
          const mine = ops.filter((e) => e.source === f.source);
          const last = mine.at(-1);
          const today = mine.filter((e) => Date.parse(e.receivedAt) > since);
          const age = last ? clock - Date.parse(last.receivedAt) : Infinity;
          const state = age < 4.5 * HOUR ? "live" : age < 48 * HOUR ? "quiet" : "silent";
          return (
            <button
              key={f.source}
              className={`ov-feed${feed === f.source ? " is-on" : ""}`}
              aria-pressed={feed === f.source}
              onClick={() => setFeed(feed === f.source ? null : f.source)}
            >
              <span className="ov-feed-name">
                <i className={`ov-dot is-${state}`} />
                <b>{f.name}</b>
                <small>{f.cadence}</small>
              </span>
              <span className="ov-feed-track">
                <i className="ov-tonight" style={{ left: `${(1 - 1.25 / 24) * 100}%` }} />
                {today.map((e) => (
                  <i
                    key={e.id}
                    className={`ov-tick${e.subject === h.id ? " is-mine" : ""}`}
                    style={{ left: `${((Date.parse(e.receivedAt) - since) / (24 * HOUR)) * 100}%`, background: f.color }}
                    title={`${at(e.receivedAt)} · ${e.type}`}
                  />
                ))}
              </span>
              <span className="ov-feed-meta">
                <b>{today.length}</b>
                <small>{last ? `last ${at(last.receivedAt)} · ${ago(age)}` : "nothing yet"}</small>
              </span>
            </button>
          );
        })}
      </section>
      <div className="ov-pair">
        <section className="av-step">
          <header>
            <span>03</span>
            <h3>Live, not nightly</h3>
            <small className="ov-hint">“a memory which only updates in a nightly batch decays into a liability”</small>
          </header>
          <LiveNotNightly snapshot={snapshot} inspect={inspect} />
        </section>
        <section className="av-step">
          <header>
            <span>04</span>
            <h3>Router telemetry · every connected router</h3>
          </header>
          <RouterTelemetry snapshot={snapshot} focus={h.id} />
        </section>
      </div>
      <div className="ov-pair">
        <section className="av-step">
          <header>
            <span>05</span>
            <h3>Orders & provisioning</h3>
            <small className="ov-hint">non-activation is a trigger, not a month-end report</small>
          </header>
          <Provisioning snapshot={snapshot} focus={h.id} />
        </section>
        <section className="av-step">
          <header>
            <span>06</span>
            <h3>Households & products</h3>
            <small className="ov-hint">one household, several products</small>
          </header>
          {net ? <Households net={net} focus={h.id} /> : <p className="av-note">Household records are held in the Supabase runtime.</p>}
        </section>
      </div>
      <div className="ov-lower">
        <section className="av-step ov-stream">
          <header>
            <span>07</span>
            <h3>Signal stream</h3>
            <label className="ov-toggle">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              Only {h.name.split(" ")[0]} and shared
            </label>
            {feed && (
              <button className="ov-clear" onClick={() => setFeed(null)}>
                {feedOf(feed)?.name} ×
              </button>
            )}
          </header>
          <div className="ov-rows" role="list">
            {stream.map((e) => {
              const f = feedOf(e.source)!;
              const who = e.subject === "shared" ? null : (e.subject as PersonId);
              const lag = Date.parse(e.receivedAt) - Date.parse(e.occurredAt);
              const tonight = Date.parse(e.receivedAt) >= clock - 1.25 * HOUR;
              return (
                <button key={e.id} role="listitem" className={`ov-row${tonight ? " is-tonight" : ""}${who === h.id ? " is-mine" : ""}`} onClick={() => inspect(e)}>
                  <time>{at(e.receivedAt)}</time>
                  <i style={{ background: f.color }} />
                  <span className="ov-row-main">
                    <code>{e.type}</code>
                    <span>{effect(e, snapshot)}</span>
                  </span>
                  <span className="ov-row-who">
                    {who ? (
                      <em style={{ color: tint[who] }}>{householdNames[who].split(" ")[0]}</em>
                    ) : (
                      <em>network</em>
                    )}
                    {lag > 60e3 && <small>+{Math.round(lag / 60e3)}m to arrive</small>}
                  </span>
                </button>
              );
            })}
            {!stream.length && <p className="av-note">No signals match this filter in the last 24 hours.</p>}
          </div>
        </section>
        <section className="av-step ov-workforce">
          <header>
            <span>08</span>
            <h3>Workforce · callback rota</h3>
          </header>
          {net ? <Rota net={net} clock={snapshot.clock} /> : <p className="av-note">No rota in this data store.</p>}
          <p className="av-note">A free slot lets the arbiter propose a callback. It only becomes a promise once it is booked with the customer.</p>
        </section>
      </div>
    </div>
  );
}

type Pulse = "quiet" | "back" | "never" | "ok";
function pulse(snapshot: Snapshot, person: PersonId): Pulse {
  const mine = snapshot.events.filter((e) => e.subject === person && e.revision > 0);
  const last = (types: string[]) => mine.filter((e) => types.includes(e.type)).at(-1);
  const overdue = last(["router.heartbeat_overdue"]);
  const back = last(["router.heartbeat_received", "service.restored_observed", "activation.first_use_observed"]);
  const everSeen = snapshot.events.some(
    (e) => e.subject === person && e.type === "router.observation_window" && (e.payload as { coverage?: string }).coverage !== "no_telemetry",
  );
  if (back && (!overdue || Date.parse(back.occurredAt) >= Date.parse(overdue.occurredAt))) return "back";
  if (!everSeen) return "never";
  return overdue ? "quiet" : "ok";
}
const pulseLabel: Record<Pulse, string> = { quiet: "quiet", back: "back", never: "never online", ok: "online" };

// Illustrative placement on a real slice of Hammersmith, W6. The topology (which home hangs off
// which access node, and incident membership) comes from the dataset; the locations do not.
// Addresses are street + district only — never a house number — so no real home is implied.
const PLACE = {
  exchange: { at: [51.4933, -0.2242] as [number, number], label: "Hammersmith exchange (fictional)" },
  nodes: {
    "ACCESS-17": [51.4983, -0.2316] as [number, number],
    "ACCESS-42": [51.4951, -0.2396] as [number, number],
  } as Record<string, [number, number]>,
  homes: {
    daniel: { at: [51.4993, -0.2349] as [number, number], address: "Aldensley Road, W6" },
    sam: { at: [51.4969, -0.2294] as [number, number], address: "Dalling Road, W6" },
    maya: { at: [51.4936, -0.2379] as [number, number], address: "Ravenscourt Road, W6" },
  } as Record<PersonId, { at: [number, number]; address: string }>,
};

/** The access network on a real map of West London, with the incident register drawn on top. */
function WestLondonMap({
  net,
  snapshot,
  focus,
  onPerson,
}: {
  net: NetworkView;
  snapshot: Snapshot;
  focus: PersonId;
  onPerson?: (p: PersonId) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    // Standard OpenStreetMap tiles (no key); desaturated in CSS to sit quietly behind the network.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const pts = [PLACE.exchange.at, ...Object.values(PLACE.nodes), ...Object.values(PLACE.homes).map((h) => h.at)];
    // Fit the network into the area to the right of the floating panel, with room for labels.
    map.current.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [330, 70], paddingBottomRight: [150, 70] });
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const rose = "#c2416b",
      line = "#9d93ad";
    // Serving areas as a planning grid: ~130 m cells, each assigned to its nearest access node
    // within reach. Cells of a node inside an open incident are shaded; the rest stay faint.
    const placed = net.nodes.filter((n) => PLACE.nodes[n.reference]);
    const metres = (a: [number, number], b: [number, number]) =>
      Math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180));
    const dLat = 0.00117,
      dLon = 0.00188;
    const lats = placed.map((n) => PLACE.nodes[n.reference][0]),
      lons = placed.map((n) => PLACE.nodes[n.reference][1]);
    for (let lat = Math.min(...lats) - 0.004; lat <= Math.max(...lats) + 0.004; lat += dLat)
      for (let lon = Math.min(...lons) - 0.006; lon <= Math.max(...lons) + 0.006; lon += dLon) {
        const c: [number, number] = [lat + dLat / 2, lon + dLon / 2];
        const nearest = placed
          .map((n) => ({ n, d: metres(c, PLACE.nodes[n.reference]) }))
          .sort((x, y) => x.d - y.d)[0];
        if (!nearest || nearest.d > 360) continue;
        const inc = nearest.n.incident?.status === "open";
        L.rectangle(
          [
            [lat, lon],
            [lat + dLat, lon + dLon],
          ],
          {
            // Rose = serving area inside an open incident; green = serving area running normally.
            color: inc ? rose : "#0f7b5f",
            weight: 0.6,
            opacity: inc ? 0.45 : 0.35,
            fillColor: inc ? rose : "#0f7b5f",
            fillOpacity: inc ? 0.13 : 0.09,
            interactive: false,
          },
        ).addTo(g);
      }

    for (const n of net.nodes) {
      const at = PLACE.nodes[n.reference];
      if (!at) continue;
      const inc = n.incident?.status === "open";
      L.polyline([PLACE.exchange.at, at], { color: inc ? rose : line, weight: 2, opacity: 0.8 }).addTo(g);
      L.marker(at, {
        icon: L.divIcon({
          className: `wl-node${inc ? " is-incident" : ""}`,
          html: `<span><i></i>${n.reference}</span>`,
          iconSize: [96, 24],
          iconAnchor: [48, 12],
        }),
      }).addTo(g);
      for (const s of n.services) {
        const p = s.person;
        if (!p || !PLACE.homes[p]) continue;
        const home = PLACE.homes[p];
        L.polyline([at, home.at], { color: s.incident === "affected" ? rose : line, weight: 1.5, opacity: 0.8, dashArray: s.incident === "excluded" ? "2 5" : undefined }).addTo(g);
        const state = pulse(snapshot, p);
        const extra = net.unattached.filter((u) => u.person === p).map((u) => u.product);
        L.marker(home.at, {
          icon: L.divIcon({
            className: `wl-pin is-${state}${p === focus ? " is-focus" : ""}`,
            html: `<span style="--c:${tint[p]}">${householdNames[p][0]}</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .bindTooltip(
            `<b>${householdNames[p]}</b><span>${home.address}</span><em class="is-${state}">● ${pulseLabel[state]}</em><small>${s.product}${extra.length ? ` + ${extra.join(", ")}` : ""}${s.incident === "affected" ? " · in " + (n.incident?.reference ?? "incident") : s.incident === "excluded" ? " · outside the incident" : ""}</small>`,
            {
              permanent: true,
              direction: p === "maya" ? "bottom" : p === "daniel" ? "left" : "right",
              className: `wl-tip${p === focus ? " is-focus" : ""}`,
              offset: p === "maya" ? [0, 14] : p === "daniel" ? [-16, 0] : [16, 0],
            },
          )
          .on("click", () => onPerson?.(p))
          .addTo(g);
      }
    }
    L.marker(PLACE.exchange.at, {
      icon: L.divIcon({ className: "wl-exchange", html: "<span>Exchange</span>", iconSize: [74, 24], iconAnchor: [37, 12] }),
    }).addTo(g);
  }, [net, snapshot, focus, onPerson]);
  const incNode = net.nodes.find((n) => n.incident?.status === "open");
  const inScope = incNode?.services.filter((s) => s.incident === "affected" && s.person).map((s) => householdNames[s.person!].split(" ")[0]) ?? [];
  const outside = net.nodes.flatMap((n) => n.services).filter((s) => s.incident === "excluded" && s.person).map((s) => householdNames[s.person!].split(" ")[0]);
  const incEvent = snapshot.events.filter((e) => e.type === "incident.confirmed").at(-1);
  return (
    <div className="wl">
      <div ref={el} className="wl-map" />
      <aside className="wl-panel">
        <span className="wl-panel-kicker">Hammersmith · W6</span>
        {incNode ? (
          <div className="wl-incident-card">
            <b>{incNode.incident!.reference}</b>
            <span>open{incEvent ? ` since ${new Date(incEvent.occurredAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}` : ""} · on {incNode.reference}</span>
            <dl>
              <div><dt>In scope</dt><dd>{inScope.join(", ") || "—"}</dd></div>
              <div><dt>Explicitly outside</dt><dd>{outside.join(", ") || "—"}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="wl-incident-card is-clear">
            <b>No open incident</b>
            <span>{net.nodes.length} access nodes reporting</span>
          </div>
        )}
        <ul className="wl-legend">
          <li><i className="lg-grid is-inc" />Serving area in an incident</li>
          <li><i className="lg-grid" />Serving area, no incident</li>
          <li><i className="lg-line is-inc" />Line on an affected node</li>
          <li><i className="lg-line is-out" />Excluded from the incident</li>
          <li><i className="lg-pin is-quiet" />Router quiet now</li>
          <li><i className="lg-pin is-back" />Router back / online</li>
        </ul>
      </aside>
      <p className="av-note wl-note">Real streets in Hammersmith, W6. The exchange, placements and street-only addresses are illustrative; which home hangs off which node, and who is in the incident, comes from the records.</p>
    </div>
  );
}

function Rota({ net, clock }: { net: NetworkView; clock: string }) {
  if (!net.slots.length) return <p className="av-note">No rota received yet.</p>;
  const start = Date.parse("2026-09-25T20:00:00Z"),
    end = Date.parse("2026-09-25T21:00:00Z");
  const x = (iso: string) => ((Math.min(Math.max(Date.parse(iso), start), end) - start) / (end - start)) * 100;
  return (
    <div className="ov-rota">
      <div className="ov-rota-track">
        {net.slots.map((s) => (
          <div key={s.startsAt} className={`ov-slot is-${s.state}`} style={{ left: `${x(s.startsAt)}%`, width: `${x(s.endsAt) - x(s.startsAt)}%` }}>
            <b>{at(s.startsAt)}</b>
            <span>{s.heldFor ? `${s.owner} · held` : "free"}</span>
          </div>
        ))}
        <i className="ov-now" style={{ left: `${x(clock)}%` }} />
      </div>
      <div className="ov-rota-axis">
        <span>21:00</span>
        <span>21:30</span>
        <span>22:00</span>
      </div>
    </div>
  );
}
