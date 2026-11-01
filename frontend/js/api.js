// Smart Traffic frontend API helper.
// The Spring Boot backend must be running at http://localhost:8080.
window.TrafficAPI = (() => {
  let baseUrl = "http://localhost:8080";

  function setBaseUrl(value) {
    baseUrl = (value || "http://localhost:8080").trim().replace(/\/+$/, "");
  }
  function getBaseUrl() { return baseUrl; }

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { data = raw; }
    if (!response.ok) {
      const message = data && typeof data === "object"
        ? (data.message || data.error || JSON.stringify(data))
        : (data || `HTTP ${response.status}`);
      throw new Error(message);
    }
    return data;
  }

  return {
    setBaseUrl, getBaseUrl,
    health: () => request("/api/health"),
    junctions: () => request("/api/network/junctions"),
    roads: () => request("/api/network/roads"),
    findRoute: body => request("/api/routes/find", { method: "POST", body: JSON.stringify(body) }),
    generateTraffic: count => request("/api/traffic/generate", {
      method: "POST", body: JSON.stringify({ count })
    }),
    dispatchEmergency: body => request("/api/emergency/request", {
      method: "POST", body: JSON.stringify(body)
    }),
    signals: () => request("/api/signals"),
    vehicles: () => request("/api/vehicles"),
    events: () => request("/api/events"),
    updateRoad: body => request("/api/roads/update", {
      method: "POST", body: JSON.stringify(body)
    })
  };
})();
