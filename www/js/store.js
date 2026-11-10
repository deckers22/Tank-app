// Entries live in localStorage on this device only.
const KEY = 'tank-app:v1';

export function loadEntries() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(KEY, JSON.stringify({ entries }));
}

const UNIT_KEY = 'tank-app:consumption-unit';

/** 'l100' (L/100 km, default) or 'kml' (km/L). */
export function loadUnit() {
  return localStorage.getItem(UNIT_KEY) === 'kml' ? 'kml' : 'l100';
}

export function saveUnit(unit) {
  localStorage.setItem(UNIT_KEY, unit);
}

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
