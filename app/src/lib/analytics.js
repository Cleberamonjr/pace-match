const KEY = "pace.analytics";

export function track(name, payload = {}) {
  const events = JSON.parse(localStorage.getItem(KEY) || "[]");
  events.push({ name, payload, at: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(events.slice(-200)));
}
