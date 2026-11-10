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

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
