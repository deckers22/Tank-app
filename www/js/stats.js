// Pure calculation helpers. No DOM access, so they can be unit-tested in Node.

/** 'YYYY-MM-DD' for a Date in local time. */
export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local-time timestamp (ms) for a 'YYYY-MM-DD' string. */
export function dateToTime(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function sortEntries(entries) {
  return [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer
  );
}

/**
 * Sorts entries and adds derived fields:
 *  cost        – litres × price per litre
 *  distance    – km since the previous fill-up (null for the first entry)
 *  consumption – L/100 km over that distance (null if unknown).
 *                Assumes every fill-up is a full tank.
 */
export function withDerived(entries) {
  const sorted = sortEntries(entries);
  return sorted.map((e, i) => {
    const prev = sorted[i - 1];
    const distance = prev ? e.odometer - prev.odometer : null;
    return {
      ...e,
      cost: e.litres * e.pricePerLitre,
      distance,
      consumption: distance > 0 ? (e.litres / distance) * 100 : null,
    };
  });
}

/** Keep entries with from <= date <= to (ISO strings; either bound may be null). */
export function filterRange(derived, from, to) {
  return derived.filter(
    (e) => (!from || e.date >= from) && (!to || e.date <= to)
  );
}

/** Totals per calendar month, including empty months between first and last. */
export function monthly(derived) {
  if (!derived.length) return [];
  const map = new Map();
  for (const e of derived) {
    const key = e.date.slice(0, 7);
    const m = map.get(key) ?? { month: key, litres: 0, cost: 0, distance: 0, count: 0 };
    m.litres += e.litres;
    m.cost += e.cost;
    m.distance += e.distance ?? 0;
    m.count += 1;
    map.set(key, m);
  }
  const out = [];
  let [y, mo] = derived[0].date.slice(0, 7).split('-').map(Number);
  const last = derived[derived.length - 1].date.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, '0')}`;
    out.push(map.get(key) ?? { month: key, litres: 0, cost: 0, distance: 0, count: 0 });
    if (key >= last) break;
    if (++mo > 12) { mo = 1; y++; }
  }
  return out;
}

export function summary(derived) {
  const sum = (f) => derived.reduce((t, e) => t + f(e), 0);
  const totalLitres = sum((e) => e.litres);
  const totalCost = sum((e) => e.cost);
  const measured = derived.filter((e) => e.distance > 0);
  const distance = measured.reduce((t, e) => t + e.distance, 0);
  const measuredLitres = measured.reduce((t, e) => t + e.litres, 0);
  return {
    count: derived.length,
    totalLitres,
    totalCost,
    distance,
    avgConsumption: distance > 0 ? (measuredLitres / distance) * 100 : null,
    avgPrice: totalLitres > 0 ? totalCost / totalLitres : null,
    avgFillCost: derived.length ? totalCost / derived.length : null,
  };
}

/** Spend in the month of `today` and the month before it. */
export function monthComparison(derived, today = new Date()) {
  const thisKey = toISODate(today).slice(0, 7);
  const prevKey = toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  const total = (key) =>
    derived.filter((e) => e.date.startsWith(key)).reduce((t, e) => t + e.cost, 0);
  return { thisMonth: total(thisKey), lastMonth: total(prevKey) };
}

/** Running total of `field` over the entries. */
export function cumulative(derived, field) {
  let t = 0;
  return derived.map((e) => (t += e[field]));
}

/**
 * Checks a candidate entry against the others. Returns an error string or null.
 * The odometer must rise with the date.
 */
export function validateEntry(candidate, others) {
  const { date, litres, odometer, pricePerLitre } = candidate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || Number.isNaN(dateToTime(date))) return 'Enter a valid date.';
  if (!(litres > 0)) return 'Litres must be greater than 0.';
  if (!(odometer >= 0)) return 'Odometer must be 0 or more.';
  if (!(pricePerLitre > 0)) return 'Price per litre must be greater than 0.';
  const sorted = sortEntries(others);
  const prev = sorted.filter((e) => e.date < date).pop();
  const next = sorted.find((e) => e.date > date);
  if (prev && odometer <= prev.odometer)
    return `Odometer must be higher than ${prev.odometer} km (fill-up on ${prev.date}).`;
  if (next && odometer >= next.odometer)
    return `Odometer must be lower than ${next.odometer} km (fill-up on ${next.date}).`;
  return null;
}

// ---- CSV ----

export const CSV_HEADER = 'date,litres,odometer,price_per_litre';

export function toCSV(entries) {
  const rows = sortEntries(entries).map(
    (e) => `${e.date},${e.litres},${e.odometer},${e.pricePerLitre}`
  );
  return [CSV_HEADER, ...rows].join('\n') + '\n';
}

/**
 * Parses CSV with columns date, litres, odometer, price per litre.
 * Accepts ',' or ';' as delimiter (';' files may use decimal commas) and an
 * optional header row. Returns { entries, skipped }.
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let skipped = 0;
  lines.forEach((line, i) => {
    const semi = line.includes(';');
    const cells = line.split(semi ? ';' : ',').map((c) => c.trim());
    const num = (s) => Number(semi ? String(s).replace(',', '.') : s);
    const e = {
      date: cells[0],
      litres: num(cells[1]),
      odometer: num(cells[2]),
      pricePerLitre: num(cells[3]),
    };
    const ok =
      cells.length >= 4 &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      e.litres > 0 && e.odometer >= 0 && e.pricePerLitre > 0;
    if (ok) entries.push(e);
    else if (i > 0 || /\d{4}-\d{2}-\d{2}/.test(line)) skipped++; // row 0 may be a header
  });
  return { entries, skipped };
}
