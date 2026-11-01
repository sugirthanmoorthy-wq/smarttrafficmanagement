(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { junctions: [], roads: [], lastRoute: null, selectedVehicleId: null, vehicles: [], signals: [], events: [] };
  const schematicJunctions = {
    J1: { x: 400, y: 230 }, J2: { x: 360, y: 470 }, J3: { x: 640, y: 430 },
    J4: { x: 680, y: 240 }, J5: { x: 250, y: 290 }, J6: { x: 300, y: 160 },
    J7: { x: 330, y: 370 }, J8: { x: 470, y: 350 }, J9: { x: 800, y: 90 },
    J10: { x: 520, y: 130 }, J11: { x: 780, y: 320 }, J12: { x: 540, y: 470 }
  };
  const emergencyRouteColors = ["#d93025", "#7b1fa2", "#00796b", "#ef6c00", "#1565c0", "#ad1457", "#455a64", "#558b2f"];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }
  function showToast(message, isError = false) {
    const container = $("toastContainer");
    if (!container) { alert(message); return; }
    const item = document.createElement("div");
    item.className = `toast show text-bg-${isError ? "danger" : "success"} border-0 mb-2`;
    item.setAttribute("role", "status");
    item.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button></div>`;
    item.querySelector("button").addEventListener("click", () => item.remove());
    container.appendChild(item);
    setTimeout(() => item.remove(), 5000);
  }
  function setBackendStatus(online, text) {
    const badge = $("backendStatusBadge");
    const banner = $("backendStatusBanner");
    if (badge) {
      badge.className = `badge ${online ? "bg-success" : "bg-danger"} cursor-pointer`;
      badge.innerHTML = `<i class="bi bi-${online ? "check-circle" : "exclamation-triangle"} me-1"></i> Backend: ${escapeHtml(text)}`;
    }
    if (banner) {
      banner.classList.toggle("online", online);
      const strong = banner.querySelector("strong");
      if (strong) strong.textContent = online ? "Operational status:" : "Backend connection issue:";
      const firstDiv = banner.querySelector("div");
      if (firstDiv) {
        firstDiv.innerHTML = `<i class="bi bi-cpu text-primary me-2"></i><strong>${online ? "Operational status:" : "Backend connection issue:"}</strong> ${escapeHtml(text)}`;
      }
    }
    if ($("dashBackendStatus")) $("dashBackendStatus").textContent = online ? "UP" : "DOWN";
  }
  function fillSelect(id, selected) {
    const select = $(id);
    if (!select) return;
    const old = selected || select.value;
    select.innerHTML = state.junctions.map(j =>
      `<option value="${escapeHtml(j.id)}">${escapeHtml(j.id)} — ${escapeHtml(j.name)}</option>`
    ).join("");
    if (old && state.junctions.some(j => j.id === old)) select.value = old;
  }
  function fillAllJunctionSelects() {
    ["routeSourceSelect","routeDestSelect","emSingleSrc","emSingleDst"].forEach(id => fillSelect(id));
    if ($("routeDestSelect") && state.junctions.length > 1) $("routeDestSelect").selectedIndex = 1;
    if ($("emSingleDst") && state.junctions.length > 1) $("emSingleDst").selectedIndex = 1;
  }

  function renderMap() {
    const host = $("dashMiniMapContainer");
    if (!host) return;
    if (!$("mapLiveTraffic")) {
      host.innerHTML = `
        <div class="live-map-toolbar">
          <label for="mapEmergencyVehicleSelect" class="form-label mb-0">Emergency vehicle</label>
          <select id="mapEmergencyVehicleSelect" class="form-select form-select-sm" aria-label="Select emergency vehicle"></select>
          <button type="button" id="btnFitEmergencyRoute" class="btn btn-sm btn-outline-primary">Fit route</button>
          <button type="button" id="btnZoomInSchematic" class="btn btn-sm btn-outline-secondary" aria-label="Zoom in">+</button>
          <button type="button" id="btnZoomOutSchematic" class="btn btn-sm btn-outline-secondary" aria-label="Zoom out">−</button>
          <button type="button" id="btnResetLiveMap" class="btn btn-sm btn-outline-secondary">Reset map</button>
          <div id="mapRouteDetails" class="small text-muted w-100" aria-live="polite"></div>
          <div id="mapEmergencyVehicleList" class="live-map-vehicle-list w-100"></div>
        </div>
        <div id="mapLiveTraffic" class="schematic-map-wrap"></div>
        <div id="mapDataNotice" class="small text-muted px-2 pt-2" role="status"></div>`;
      host.addEventListener("change", event => {
        if (event.target.id === "mapEmergencyVehicleSelect") {
          state.selectedVehicleId = event.target.value || null;
          renderMap();
        }
      });
      host.addEventListener("click", event => {
        const vehicleButton = event.target.closest("[data-map-vehicle]");
        if (vehicleButton) {
          state.selectedVehicleId = vehicleButton.dataset.mapVehicle;
          renderMap();
        } else if (event.target.closest("#btnFitEmergencyRoute")) {
          fitSelectedEmergencyRoute();
        } else if (event.target.closest("#btnZoomInSchematic")) {
          zoomSchematic(0.8);
        } else if (event.target.closest("#btnZoomOutSchematic")) {
          zoomSchematic(1.25);
        } else if (event.target.closest("#btnResetLiveMap")) {
          state.schematicViewBox = { x: 0, y: 0, width: 900, height: 640 };
          renderMap();
        }
      });
      host.addEventListener("wheel", event => {
        if (!event.target.closest("#mapLiveTraffic")) return;
        event.preventDefault();
        zoomSchematic(event.deltaY < 0 ? 0.9 : 1.1);
      }, { passive: false });
      host.addEventListener("pointerdown", event => {
        if (!event.target.closest("#mapLiveTraffic")) return;
        const svg = $("mapNetworkSvg");
        if (!svg) return;
        svg.setPointerCapture(event.pointerId);
        state.schematicDrag = { x: event.clientX, y: event.clientY, viewBox: { ...state.schematicViewBox } };
      });
      host.addEventListener("pointermove", event => {
        if (!state.schematicDrag) return;
        const svg = $("mapNetworkSvg");
        const rect = svg?.getBoundingClientRect();
        if (!svg || !rect?.width || !rect?.height) return;
        const drag = state.schematicDrag;
        const view = drag.viewBox;
        const x = view.x - (event.clientX - drag.x) * view.width / rect.width;
        const y = view.y - (event.clientY - drag.y) * view.height / rect.height;
        state.schematicViewBox = { ...view, x, y };
        svg.setAttribute("viewBox", `${x} ${y} ${view.width} ${view.height}`);
      });
      host.addEventListener("pointerup", () => { state.schematicDrag = null; });
      state.schematicViewBox = { x: 0, y: 0, width: 900, height: 640 };
    }

    const emergencyVehicles = state.vehicles.filter(vehicle => ["AMBULANCE", "FIRE_TRUCK", "POLICE"].includes(vehicle.vehicleType));
    if (!state.selectedVehicleId || !emergencyVehicles.some(vehicle => vehicle.id === state.selectedVehicleId)) {
      state.selectedVehicleId = emergencyVehicles[0]?.id || null;
    }
    const selector = $("mapEmergencyVehicleSelect");
    if (selector) {
      selector.innerHTML = emergencyVehicles.map(vehicle =>
        `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.id)} — ${escapeHtml(vehicle.vehicleType)}</option>`
      ).join("");
      selector.value = state.selectedVehicleId || "";
      selector.disabled = emergencyVehicles.length === 0;
    }
    const selected = emergencyVehicles.find(vehicle => vehicle.id === state.selectedVehicleId);
    const selectedVehicleIndex = emergencyVehicles.findIndex(vehicle => vehicle.id === state.selectedVehicleId);
    const junctionNames = new Map(state.junctions.map(junction => [junction.id, junction.name]));
    const visibleJunctions = state.junctions.filter(junction => schematicJunctions[junction.id]);
    const uniqueRoads = new Map();
    state.roads.forEach(road => {
      const key = [road.source, road.destination].sort().join(":");
      if (!uniqueRoads.has(key)) uniqueRoads.set(key, road);
    });
    const routes = emergencyVehicles.map((vehicle, index) => ({
      vehicle,
      index,
      nodes: parseVehicleRoute(vehicle.route),
      color: emergencyRouteColors[index % emergencyRouteColors.length]
    })).filter(route => route.nodes.length > 0 && route.nodes.every(node => schematicJunctions[node]));

    const detailHost = $("mapRouteDetails");
    if (detailHost) {
      const routeNodes = selected ? parseVehicleRoute(selected.route) : [];
      detailHost.textContent = selected
        ? `${selected.id} · ${selected.vehicleType} · ${junctionNames.get(selected.source) || selected.source} → ${junctionNames.get(selected.destination) || selected.destination} · ${selected.status || "Status unavailable"} · ${routeNodes.length ? routeNodes.join(" → ") : "Route unavailable"}${selected.distanceKm !== null && selected.distanceKm !== undefined && Number.isFinite(Number(selected.distanceKm)) ? ` · ${selected.distanceKm} km` : ""}${selected.estimatedTicks !== null && selected.estimatedTicks !== undefined && Number.isFinite(Number(selected.estimatedTicks)) ? ` · ${selected.estimatedTicks} min` : ""}`
        : "No dispatched emergency vehicles are available.";
    }
    const vehicleList = $("mapEmergencyVehicleList");
    if (vehicleList) {
      vehicleList.innerHTML = emergencyVehicles.length
        ? `<div class="small fw-semibold mb-1">Dispatched vehicles</div><div class="d-flex flex-wrap gap-2">${emergencyVehicles.map((vehicle, index) => `<button type="button" class="btn btn-sm ${vehicle.id === state.selectedVehicleId ? "btn-primary" : "btn-outline-secondary"}" data-map-vehicle="${escapeHtml(vehicle.id)}"><span class="route-color-dot" style="--route-color:${emergencyRouteColors[index % emergencyRouteColors.length]}"></span>${escapeHtml(vehicle.id)} · ${escapeHtml(vehicle.status || "UNKNOWN")}</button>`).join("")}</div>`
        : '<div class="small text-muted">No emergency vehicles have been dispatched.</div>';
    }
    const notice = $("mapDataNotice");
    if (notice) {
      notice.textContent = "Illustrative simulated network layout (not to scale and not geographic). Road links and route sequences come from backend data; vehicle positions are not tracked.";
    }

    const svg = $("mapNetworkSvg");
    const viewBox = state.schematicViewBox;
    const roadsMarkup = [...uniqueRoads.values()].map(road => {
      const start = schematicJunctions[road.source];
      const end = schematicJunctions[road.destination];
      if (!start || !end) return "";
      const traffic = String(road.trafficLevel || "LIGHT").toLowerCase();
      return `<g><line class="schematic-road-underlay" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"></line><line class="schematic-road ${road.closed ? "closed" : ""} ${escapeHtml(traffic)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"><title>${escapeHtml(road.source)} → ${escapeHtml(road.destination)} · ${escapeHtml(road.distanceKm)} km · ${escapeHtml(road.trafficLevel)}${road.closed ? " · CLOSED" : ""}</title></line></g>`;
    }).join("");
    const routeMarkup = routes.map(route => {
      const laneOffset = route.index === selectedVehicleIndex ? 0 : (route.index - selectedVehicleIndex) * 6;
      const points = offsetSchematicRoute(route.nodes, laneOffset);
      if (!points.length) return "";
      const selectedRoute = route.vehicle.id === state.selectedVehicleId;
      const routeLine = points.length > 1
        ? `<polyline class="emergency-route ${selectedRoute ? "selected" : ""}" stroke="${route.color}" points="${points.map(point => `${point.x},${point.y}`).join(" ")}"><title>${escapeHtml(route.vehicle.id)} · ${escapeHtml(route.vehicle.vehicleType)} · ${escapeHtml(route.nodes.join(" → "))}</title></polyline>`
        : "";
      const start = points[0];
      const end = points[points.length - 1];
      return `<g class="emergency-route-group ${selectedRoute ? "selected" : ""}" data-route-vehicle="${escapeHtml(route.vehicle.id)}">${routeLine}<circle class="route-endpoint" cx="${start.x}" cy="${start.y}" r="8" fill="${route.color}"><title>${escapeHtml(route.vehicle.id)} origin · ${escapeHtml(route.nodes[0])}</title></circle>${points.length > 1 ? `<circle class="route-endpoint destination" cx="${end.x}" cy="${end.y}" r="8" fill="${route.color}"><title>${escapeHtml(route.vehicle.id)} destination · ${escapeHtml(route.nodes[route.nodes.length - 1])}</title></circle>` : ""}</g>`;
    }).join("");
    const junctionMarkup = visibleJunctions.map(junction => {
      const point = schematicJunctions[junction.id];
      const name = junction.name || junction.id;
      return `<g class="schematic-junction" data-junction="${escapeHtml(junction.id)}"><circle cx="${point.x}" cy="${point.y}" r="16"></circle><text class="junction-id" x="${point.x}" y="${point.y + 4}">${escapeHtml(junction.id)}</text><text class="junction-name" x="${point.x + 20}" y="${point.y - 15}">${escapeHtml(name)}</text><title>${escapeHtml(junction.id)} · ${escapeHtml(name)}</title></g>`;
    }).join("");
    const legendMarkup = emergencyVehicles.length
      ? emergencyVehicles.map((vehicle, index) => `<span><i class="route-color-dot" style="--route-color:${emergencyRouteColors[index % emergencyRouteColors.length]}"></i>${escapeHtml(vehicle.id)}</span>`).join("")
      : '<span>No emergency routes</span>';
    const svgMarkup = `
      <svg id="mapNetworkSvg" class="network-svg schematic-network-svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="Simulated traffic network schematic">
        <rect width="900" height="640" fill="#f4f1ea"></rect>
        <text x="30" y="40" class="schematic-title">Imaginary Road Junction Map</text>
        <text x="30" y="62" class="schematic-subtitle">12 junctions · illustrative layout · not to scale</text>
        <ellipse cx="470" cy="350" rx="70" ry="48" fill="#cfe3c4" opacity=".55"></ellipse>
        <path d="M120 540 Q300 600 520 560 T860 590 L860 640 L120 640 Z" fill="#cfe0ee" opacity=".65"></path>
        <g class="schematic-roads">${roadsMarkup}</g>
        <g class="schematic-routes">${routeMarkup}</g>
        <g class="schematic-junctions">${junctionMarkup}</g>
        <g transform="translate(840 560)" fill="#444"><polygon points="0,-28 7,0 0,-6 -7,0"></polygon><text y="-34" font-size="12" text-anchor="middle" font-weight="bold">N</text></g>
      </svg>
      <div class="schematic-legend"><span><i class="road-legend-line"></i> Backend road</span><span><i class="route-legend-line"></i> Emergency route</span>${legendMarkup}</div>`;
    if (svg) {
      const wrap = $("mapLiveTraffic");
      if (wrap) wrap.innerHTML = svgMarkup;
    } else {
      $("mapLiveTraffic").innerHTML = svgMarkup;
    }
  }

  function parseVehicleRoute(route) {
    if (Array.isArray(route)) return route;
    if (typeof route !== "string" || !route.trim()) return [];
    try {
      const parsed = JSON.parse(route);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return route.split(/\s*(?:->|→)\s*/).filter(Boolean);
    }
    return [];
  }

  function offsetSchematicRoute(nodes, offset) {
    const points = nodes.map(node => schematicJunctions[node]).filter(Boolean);
    if (points.length < 2 || offset === 0) return points;
    return points.map((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: point.x - dy / length * offset, y: point.y + dx / length * offset };
    });
  }

  function zoomSchematic(factor) {
    const view = state.schematicViewBox;
    const width = Math.max(240, Math.min(900, view.width * factor));
    const height = Math.max(170, Math.min(640, view.height * factor));
    state.schematicViewBox = {
      x: view.x + (view.width - width) / 2,
      y: view.y + (view.height - height) / 2,
      width,
      height
    };
    $("mapNetworkSvg")?.setAttribute("viewBox", `${state.schematicViewBox.x} ${state.schematicViewBox.y} ${width} ${height}`);
  }

  function fitSelectedEmergencyRoute() {
    const selected = state.vehicles.find(vehicle => vehicle.id === state.selectedVehicleId);
    const points = selected ? parseVehicleRoute(selected.route).map(node => schematicJunctions[node]).filter(Boolean) : [];
    if (!points.length) return;
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(maxX - minX + 140, 220);
    const height = Math.max(maxY - minY + 120, 170);
    state.schematicViewBox = { x: (minX + maxX - width) / 2, y: (minY + maxY - height) / 2, width, height };
    $("mapNetworkSvg")?.setAttribute("viewBox", `${state.schematicViewBox.x} ${state.schematicViewBox.y} ${width} ${height}`);
  }
  function renderRoads() {
    const host = $("networkSvgContainer");
    const rows = state.roads.map(r => `
      <tr>
        <td>${escapeHtml(r.source)} → ${escapeHtml(r.destination)}</td>
        <td>${Number(r.distanceKm).toFixed(1)} km</td>
        <td>${Number(r.baseSpeedKmh).toFixed(0)} km/h</td>
        <td>${escapeHtml(r.trafficLevel)}</td>
        <td><span class="badge ${r.closed ? "bg-danger" : "bg-success"}">${r.closed ? "CLOSED" : "OPEN"}</span></td>
        <td><button class="btn btn-sm btn-outline-custom" data-road-a="${escapeHtml(r.source)}" data-road-b="${escapeHtml(r.destination)}" data-road-closed="${r.closed}" data-road-traffic="${escapeHtml(r.trafficLevel)}">Edit</button></td>
      </tr>`).join("");
    const table = `<div class="table-responsive"><table class="table-custom"><thead><tr><th>Road</th><th>Distance</th><th>Base speed</th><th>Traffic</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No road data returned.</td></tr>'}</tbody></table></div>`;
    if (host) host.innerHTML = `<div class="mb-3 text-info">Loaded ${state.junctions.length} junctions and ${state.roads.length} road records from MySQL.</div>${table}`;
    document.querySelectorAll("[data-road-a]").forEach(button => {
      button.addEventListener("click", () => openRoadEditor(button.dataset.roadA, button.dataset.roadB, button.dataset.roadClosed === "true", button.dataset.roadTraffic));
    });
  }
  function renderVehicles() {
    const rows = state.vehicles.map(v => `<tr><td>${escapeHtml(v.id)}</td><td>${escapeHtml(v.vehicleType)}</td><td>${escapeHtml(v.source)} → ${escapeHtml(v.destination)}</td><td>${escapeHtml(v.route || "")}</td><td>${escapeHtml(v.status)}</td><td>${v.estimatedTicks ?? "—"}</td></tr>`).join("");
    const table = `<div class="table-responsive"><table class="table-custom"><thead><tr><th>ID</th><th>Type</th><th>From → To</th><th>Route</th><th>Status</th><th>Time</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="text-center text-muted">No vehicles saved yet.</td></tr>'}</tbody></table></div>`;
    if ($("liveTrafficTrackingBody")) $("liveTrafficTrackingBody").innerHTML = rows || '<tr><td colspan="6" class="text-center text-muted">No vehicles saved yet.</td></tr>';
    if ($("dashActiveVehiclesBody")) $("dashActiveVehiclesBody").innerHTML = table;

    const activeVehicles = state.vehicles.filter(v => v.status && !["COMPLETED","SCHEDULED"].includes(v.status)).length;
    const scheduledVehicles = state.vehicles.filter(v => v.status === "SCHEDULED").length;
    const activeEmergencies = state.vehicles.filter(v => ["AMBULANCE","FIRE_TRUCK","POLICE"].includes(v.vehicleType) && v.status && !["COMPLETED","SCHEDULED"].includes(v.status)).length;
    const emergencyCompleted = state.vehicles.filter(v => ["AMBULANCE","FIRE_TRUCK","POLICE"].includes(v.vehicleType) && v.status === "COMPLETED").length;

    if ($("dashTotalVehicles")) $("dashTotalVehicles").textContent = String(activeVehicles + scheduledVehicles);
    if ($("dashActiveEmergencies")) $("dashActiveEmergencies").textContent = activeEmergencies;
    if ($("dashEmergencyQueueCount")) $("dashEmergencyQueueCount").textContent = state.vehicles.filter(v => ["AMBULANCE","FIRE_TRUCK","POLICE"].includes(v.vehicleType)).length;
    if ($("repEmergencyCompleted")) $("repEmergencyCompleted").textContent = emergencyCompleted;
    if ($("dashScheduledVehicles")) $("dashScheduledVehicles").textContent = scheduledVehicles;
    if ($("dashTrafficEvents")) $("dashTrafficEvents").textContent = state.events.length;
  }

  function renderEmergencyQueue() {
    const queue = state.vehicles
      .filter(v => ["AMBULANCE","FIRE_TRUCK","POLICE"].includes(v.vehicleType))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const dashboard = $("dashEmergencyQueueBody");
    if (dashboard) {
      if (!queue.length) {
        dashboard.innerHTML = '<div class="p-3 text-muted">No emergency requests have been dispatched yet.</div>';
      } else {
        dashboard.innerHTML = queue.slice(0, 5).map((v, index) => `
          <div class="d-flex justify-content-between align-items-center border-bottom px-3 py-2">
            <div>
              <div class="fw-semibold">${index + 1}. ${escapeHtml(v.id)}</div>
              <small class="text-muted">${escapeHtml(v.vehicleType)} · ${escapeHtml(v.source)} → ${escapeHtml(v.destination)}</small>
            </div>
            <span class="badge ${v.status === "DISPATCHED" || v.status === "SCHEDULED" ? "bg-warning text-dark" : v.status === "COMPLETED" ? "bg-success" : "bg-primary"}">${escapeHtml(v.status || "DISPATCHED")}</span>
          </div>
        `).join("");
      }
    }

    const body = $("emQueueTableBody");
    if (!body) return;
    if (!queue.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No emergency requests have been dispatched yet.</td></tr>';
      return;
    }
    body.innerHTML = queue.map((v, index) => `
      <tr class="${v.status && v.status !== "COMPLETED" ? "queue-row-active" : "queue-row-complete"}">
        <td>${index + 1}</td>
        <td>${escapeHtml(v.id)}</td>
        <td>${escapeHtml(v.vehicleType)}</td>
        <td>${escapeHtml(v.source)}</td>
        <td>${escapeHtml(v.destination)}</td>
        <td><span class="badge ${v.status === "DISPATCHED" || v.status === "SCHEDULED" ? "bg-warning text-dark" : v.status === "COMPLETED" ? "bg-success" : "bg-primary"}">${escapeHtml(v.status || "DISPATCHED")}</span></td>
      </tr>
    `).join("");
  }

  function renderSignals() {
    const host = $("signalsGridContainer");
    if (!host) return;
    host.innerHTML = state.signals.map(s => {
      const phase = String(s.phase || "NORMAL").toLowerCase().replace(/[^a-z_]/g, "");
      return `<div class="col-12 col-md-6 col-xl-4 mb-3"><div class="signal-card ${phase.includes("emergency") ? "preempted" : ""}"><div class="d-flex justify-content-between align-items-center"><strong>${escapeHtml(s.junctionId)}</strong><span class="phase-badge phase-${phase.includes("emergency") ? "emergency" : "normal"}">${escapeHtml(s.phase || "NORMAL")}</span></div><div class="text-muted small mt-2">Priority vehicle: ${escapeHtml(s.priorityVehicleId || "None")}</div><div class="text-muted small">Updated: ${escapeHtml(s.updatedAt || "—")}</div></div></div>`;
    }).join("") || '<div class="text-muted">No signal data returned.</div>';
  }
  function renderEvents() {
    const items = state.events.map(e => `<div class="event-item"><span class="event-badge ${String(e.eventType || "").includes("EMERGENCY") ? "emergency" : String(e.eventType || "").includes("TRAFFIC") ? "traffic" : "system"}">${escapeHtml(e.eventType)}</span><div><div class="text-white">${escapeHtml(e.description)}</div><small class="text-muted">${escapeHtml(e.junctionId || "City-wide")} · ${escapeHtml(e.createdAt || "")}</small></div></div>`).join("");
    if ($("eventsFullStreamContainer")) $("eventsFullStreamContainer").innerHTML = items || '<div class="p-3 text-muted">No traffic events yet.</div>';
    if ($("dashRecentEventsList")) $("dashRecentEventsList").innerHTML = items || '<div class="p-3 text-muted">No traffic events yet.</div>';
  }
  async function refreshAll() {
    const [junctions, roads, vehicles, signals, events] = await Promise.all([
      TrafficAPI.junctions(), TrafficAPI.roads(), TrafficAPI.vehicles(), TrafficAPI.signals(), TrafficAPI.events()
    ]);
    state.junctions = junctions || [];
    state.roads = roads || [];
    state.vehicles = vehicles || [];
    state.signals = signals || [];
    state.events = events || [];
    fillAllJunctionSelects();
    if ($("dashJunctionCount")) $("dashJunctionCount").textContent = state.junctions.length;
    renderRoads(); renderVehicles(); renderEmergencyQueue(); renderSignals(); renderEvents(); renderMap();
    setBackendStatus(true, "CONNECTED");
  }
  async function guarded(action) {
    try { await action(); }
    catch (error) {
      console.error("Smart Traffic API error:", error);
      setBackendStatus(false, "ERROR");
      showToast(error.message || "Request failed. Check Spring Boot and MySQL.", true);
    }
  }
  function showTab(tab) {
    document.querySelectorAll(".tab-view").forEach(el => el.classList.add("d-none"));
    const view = $("view-" + tab);
    if (view) view.classList.remove("d-none");
    document.querySelectorAll(".nav-link-custom").forEach(el => el.classList.toggle("active", el.dataset.tab === tab));
    document.querySelector(".app-sidebar")?.classList.remove("show");
  }
  window.App = window.App || {};
  window.App.switchTab = showTab;
  window.App.toggleMapExpanded = () => {
    const card = $("liveMapCard");
    if (!card) return;
    const expanded = card.classList.toggle("map-expanded");
    const button = card.querySelector(".card-glass-header button");
    if (button) button.innerHTML = expanded
      ? 'Close Map <i class="bi bi-fullscreen-exit ms-1"></i>'
      : 'Expand View <i class="bi bi-arrows-fullscreen ms-1"></i>';
  };

  function openRoadEditor(a, b, closed, traffic) {
    if ($("roadModalA")) $("roadModalA").value = a;
    if ($("roadModalB")) $("roadModalB").value = b;
    if ($("roadModalStatus")) $("roadModalStatus").textContent = closed ? "CLOSED" : "OPEN";
    if ($("btnRoadModalToggleClosure")) $("btnRoadModalToggleClosure").dataset.closed = String(closed);
    if ($("roadModalTrafficSelect")) $("roadModalTrafficSelect").value = traffic || "LIGHT";
    if (window.bootstrap && $("roadActionModal")) bootstrap.Modal.getOrCreateInstance($("roadActionModal")).show();
    else showToast(`${a} → ${b}: ${closed ? "CLOSED" : "OPEN"}, ${traffic}`);
  }
  async function saveRoadUpdate() {
    const closed = $("btnRoadModalToggleClosure")?.dataset.closed === "true";
    await TrafficAPI.updateRoad({
      source: $("roadModalA")?.value,
      destination: $("roadModalB")?.value,
      closed,
      trafficLevel: $("roadModalTrafficSelect")?.value || "LIGHT"
    });
    showToast("Road status updated in MySQL.");
    await refreshAll();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-link-custom[data-tab]").forEach(link => link.addEventListener("click", () => showTab(link.dataset.tab)));
    $("btnSaveBackendUrl")?.addEventListener("click", () => {
      TrafficAPI.setBaseUrl($("backendUrlInput")?.value);
      guarded(async () => { await refreshAll(); showToast("Backend connected."); if (window.bootstrap && $("backendConfigModal")) bootstrap.Modal.getOrCreateInstance($("backendConfigModal")).hide(); });
    });
    $("backendStatusBadge")?.addEventListener("click", () => {
      if (window.bootstrap && $("backendConfigModal")) bootstrap.Modal.getOrCreateInstance($("backendConfigModal")).show();
    });
    $("backendStatusBanner")?.addEventListener("click", event => {
      if (event.target.closest("button") || event.currentTarget === event.target) {
        if (window.bootstrap && $("backendConfigModal")) bootstrap.Modal.getOrCreateInstance($("backendConfigModal")).show();
      }
    });
    $("btnFindRoute")?.addEventListener("click", () => guarded(async () => {
      const result = await TrafficAPI.findRoute({
        vehicleType: $("routeVehicleTypeSelect")?.value || "NORMAL",
        source: $("routeSourceSelect")?.value,
        destination: $("routeDestSelect")?.value
      });
      state.lastRoute = result;
      $("routeResultCard")?.classList.remove("d-none");
      if ($("routeErrorMessage")) $("routeErrorMessage").classList.add("d-none");
      if ($("resVehicleType")) $("resVehicleType").textContent = result.vehicleType;
      if ($("resDistance")) $("resDistance").textContent = `${result.distanceKm} km`;
      if ($("resEstTime")) $("resEstTime").textContent = `${result.estimatedTicks} min`;
      if ($("resCorridorSteps")) $("resCorridorSteps").innerHTML = (result.route || []).map((node,i) => `${i ? '<span class="corridor-arrow">→</span>' : ""}<span class="corridor-node">${escapeHtml(node)}</span>`).join("");
      if ($("resRouteSegmentsTable")) $("resRouteSegmentsTable").innerHTML = (result.segments || []).map((s,i) => `<tr><td>${i+1}</td><td>${escapeHtml(s.from)} → ${escapeHtml(s.to)}</td><td>${s.distanceKm} km</td><td>${s.baseSpeedKmh} km/h</td><td>${escapeHtml(s.trafficLevel)}</td><td>${s.cost}</td></tr>`).join("");
      showToast("Optimal route calculated by the Java backend.");
    }));
    $("btnDispatchRouteVehicle")?.addEventListener("click", () => guarded(async () => {
      const r = state.lastRoute;
      if (!r) throw new Error("Calculate a route first.");
      if (r.vehicleType === "NORMAL") {
        const result = await TrafficAPI.generateTraffic(3);
        showToast(`Generated ${result.count} traffic vehicles. Normal route dispatch is saved through traffic generation.`);
      } else {
        const result = await TrafficAPI.dispatchEmergency({ vehicleType:r.vehicleType, source:r.source, destination:r.destination });
        state.selectedVehicleId = result.id;
        showToast(`Emergency ${result.id} dispatched with green corridor.`);
      }
      await refreshAll();
    }));
    $("btnGenerateTraffic")?.addEventListener("click", () => guarded(async () => {
      const count = Math.max(3, Math.min(10, Number($("randomVehicleCountInput")?.value || 6)));
      const result = await TrafficAPI.generateTraffic(count);
      showToast(`Generated and saved ${result.count} vehicles.`);
      await refreshAll();
    }));
    $("btnDispatchSingleEmergency")?.addEventListener("click", () => guarded(async () => {
      const result = await TrafficAPI.dispatchEmergency({
        id: $("emSingleId")?.value?.trim(),
        vehicleType: $("emSingleType")?.value,
        source: $("emSingleSrc")?.value,
        destination: $("emSingleDst")?.value
      });
      state.selectedVehicleId = result.id;
      showToast(`Dispatched ${result.id}; green corridor enabled.`);
      await refreshAll();
    }));
    $("btnRoadModalToggleClosure")?.addEventListener("click", () => {
      const next = $("btnRoadModalToggleClosure").dataset.closed !== "true";
      $("btnRoadModalToggleClosure").dataset.closed = String(next);
      if ($("roadModalStatus")) $("roadModalStatus").textContent = next ? "CLOSED (pending save)" : "OPEN (pending save)";
    });
    $("btnRoadModalApplyTraffic")?.addEventListener("click", () => guarded(saveRoadUpdate));
    $("btnTriggerRoadClosure")?.addEventListener("click", () => {
      const road = state.roads.find(r => r.source === "J1" && r.destination === "J2") || state.roads[0];
      if (road) openRoadEditor(road.source, road.destination, !road.closed, road.trafficLevel);
      showToast("Choose Apply Traffic Level to save the road update.");
    });
    $("btnTriggerHeavyTraffic")?.addEventListener("click", () => {
      const road = state.roads.find(r => r.source === "J2" && r.destination === "J3") || state.roads.find(r => !r.closed);
      if (road) openRoadEditor(road.source, road.destination, road.closed, "HEAVY");
    });
    $("btnRunAutomatedTests")?.addEventListener("click", () => guarded(async () => {
      const health = await TrafficAPI.health();
      const roads = await TrafficAPI.roads();
      const junctions = await TrafficAPI.junctions();
      const result = $("testResultsContainer");
      if (result) result.innerHTML = `<div class="alert alert-success">API smoke tests passed: backend health UP, ${junctions.length} junctions, ${roads.length} road records.</div>`;
    }));
    $("eventsSearchInput")?.addEventListener("input", () => {
      const q = $("eventsSearchInput").value.toLowerCase();
      document.querySelectorAll("#eventsFullStreamContainer .event-item").forEach(el => { el.style.display = el.textContent.toLowerCase().includes(q) ? "" : "none"; });
    });
    $("dashAvgTravelTime") && ($("dashAvgTravelTime").textContent = "—");
    $("dashAvgWaitTime") && ($("dashAvgWaitTime").textContent = "—");
    guarded(async () => {
      await TrafficAPI.health();
      await refreshAll();
      showToast("Connected to Spring Boot + MySQL.");
    });
    // Refresh read-only dashboard data every 10 seconds.
    setInterval(() => guarded(refreshAll), 10000);
  });
})();
