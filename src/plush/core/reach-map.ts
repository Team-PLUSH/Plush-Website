import { REACH_VIEWS, type ReachSchool, type ReachView } from "../data/reach";
import type { Cleanup } from "../types";

type LatLng = [number, number];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two schools, in km. */
function distanceKm(a: ReachSchool, b: ReachSchool) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Outline around all the schools (convex hull, Andrew's monotone chain). */
function hull(schools: ReachSchool[]): ReachSchool[] {
  const pts = [...schools].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  if (pts.length < 3) return pts;
  const cross = (o: ReachSchool, a: ReachSchool, b: ReachSchool) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: ReachSchool[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: ReachSchool[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area inside the outline, in km² (local flat projection; fine at city/province scale). */
function areaKm2(outline: ReachSchool[]) {
  if (outline.length < 3) return 0;
  const lat0 = toRad(outline.reduce((sum, p) => sum + p.lat, 0) / outline.length);
  const xy = outline.map((p) => [
    EARTH_RADIUS_KM * toRad(p.lng) * Math.cos(lat0),
    EARTH_RADIUS_KM * toRad(p.lat),
  ]);
  let twice = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

const formatNumber = (n: number) =>
  n >= 100 ? Math.round(n).toLocaleString("en-CA") : n.toFixed(1).replace(/\.0$/, "");

/** The stat card: area when there are 3+ schools, otherwise the distance between them. */
function describe(view: ReachView) {
  const outline = hull(view.schools);
  const count = view.schools.length;
  if (outline.length >= 3) {
    const area = areaKm2(outline);
    const pct = (area / view.regionAreaKm2) * 100;
    const pctText =
      pct < 0.1 ? "under 0.1%" : `about ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
    return {
      outline,
      value: formatNumber(area),
      unit: "km²",
      caption: `Spanned by ${count} ${view.noun}, ${pctText} of ${view.regionName} area.`,
    };
  }
  if (count === 2) {
    return {
      outline,
      value: formatNumber(distanceKm(view.schools[0], view.schools[1])),
      unit: "km",
      caption: `Between our ${count} ${view.noun}, end to end.`,
    };
  }
  return { outline, value: String(count), unit: "", caption: `${view.noun} so far.` };
}

const MARKER_COLORS = ["#a8bede", "#bfa8d8", "#a4c9b0"];

/**
 * The home page "reach" map. Leaflet and the OpenStreetMap tiles are only
 * loaded once the section scrolls near the screen, so visitors who never get
 * that far make no request to a third party.
 */
export function mountReachMap(): Cleanup {
  const root = document.querySelector<HTMLElement>(".reach");
  const mapEl = root?.querySelector<HTMLElement>(".reach-map");
  if (!root || !mapEl) return () => {};

  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-reach-view]"));
  const valueEl = root.querySelector<HTMLElement>(".reach-value");
  const unitEl = root.querySelector<HTMLElement>(".reach-unit");
  const captionEl = root.querySelector<HTMLElement>(".reach-caption");
  const listEl = root.querySelector<HTMLElement>(".reach-list");

  let disposed = false;
  let teardownMap: (() => void) | null = null;
  let showView: (id: string) => void = () => {};

  const renderText = (view: ReachView) => {
    const info = describe(view);
    if (valueEl) valueEl.textContent = info.value;
    if (unitEl) unitEl.textContent = info.unit;
    if (captionEl) captionEl.textContent = info.caption;
    if (listEl) {
      listEl.replaceChildren(
        ...view.schools.map((school, i) => {
          const li = document.createElement("li");
          li.className = `reach-chip reach-chip-${i % 3}`;
          li.textContent = school.name;
          return li;
        }),
      );
    }
    return info;
  };

  const select = (id: string) => {
    const view = REACH_VIEWS.find((v) => v.id === id) ?? REACH_VIEWS[0];
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.reachView === view.id)));
    renderText(view);
    showView(view.id);
  };

  const onClick = (event: Event) => {
    const id = (event.currentTarget as HTMLButtonElement).dataset.reachView;
    if (id) select(id);
  };
  buttons.forEach((b) => b.addEventListener("click", onClick));
  select(REACH_VIEWS[0].id);

  const loadMap = async () => {
    const L = (await import("leaflet")).default;
    if (disposed) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(mapEl, {
      scrollWheelZoom: false, // don't hijack page scrolling
      zoomSnap: 0.25,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.attributionControl.setPrefix(false);

    const layer = L.layerGroup().addTo(map);
    let hasView = false;

    showView = (id: string) => {
      const view = REACH_VIEWS.find((v) => v.id === id) ?? REACH_VIEWS[0];
      const { outline } = describe(view);
      layer.clearLayers();
      const shape: LatLng[] = outline.map((p) => [p.lat, p.lng]);
      if (shape.length >= 3) {
        L.polygon(shape, { className: "reach-shape" }).addTo(layer);
      } else if (shape.length === 2) {
        L.polyline(shape, { className: "reach-shape" }).addTo(layer);
      }
      view.schools.forEach((school, i) => {
        L.circleMarker([school.lat, school.lng], {
          radius: 9,
          weight: 3,
          color: "#1f2342",
          fillColor: MARKER_COLORS[i % MARKER_COLORS.length],
          fillOpacity: 1,
          className: "reach-dot",
        })
          .bindTooltip(school.name, { direction: "top", offset: [0, -8], className: "reach-tip" })
          .addTo(layer);
      });
      const bounds = L.latLngBounds(view.schools.map((s) => [s.lat, s.lng] as LatLng));
      // Keep every school clear of the stat card, which sits over the map's
      // bottom-left corner on wider screens.
      const card = root.querySelector<HTMLElement>(".reach-card");
      const cardOverlaps = card ? getComputedStyle(card).position === "absolute" : false;
      const bottom = cardOverlaps && card ? card.offsetHeight + 50 : 50;
      const fit = {
        paddingTopLeft: [50, 50] as [number, number],
        paddingBottomRight: [50, bottom] as [number, number],
        maxZoom: 13,
      };
      // Leaflet can only animate from an existing view, so the first one snaps.
      if (hasView && !reduceMotion) map.flyToBounds(bounds, { ...fit, duration: 1.1 });
      else map.fitBounds(bounds, { ...fit, animate: false });
      hasView = true;
    };

    const current = buttons.find((b) => b.getAttribute("aria-pressed") === "true");
    showView(current?.dataset.reachView ?? REACH_VIEWS[0].id);

    // The section starts out hidden when the site opens on another page.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(mapEl);

    teardownMap = () => {
      resize.disconnect();
      map.remove();
    };
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "undefined") {
    void loadMap();
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer?.disconnect();
          void loadMap();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(mapEl);
  }

  return () => {
    disposed = true;
    observer?.disconnect();
    buttons.forEach((b) => b.removeEventListener("click", onClick));
    teardownMap?.();
  };
}
