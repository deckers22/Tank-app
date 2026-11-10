import test from 'node:test';
import assert from 'node:assert/strict';
import {
  withDerived, monthly, summary, monthComparison, cumulative,
  validateEntry, toCSV, parseCSV, filterRange, toISODate,
} from '../www/js/stats.js';

const entries = [
  { id: 'b', date: '2026-02-10', litres: 40, odometer: 10800, pricePerLitre: 2.0 },
  { id: 'a', date: '2026-01-05', litres: 45, odometer: 10000, pricePerLitre: 1.9 },
  { id: 'c', date: '2026-04-20', litres: 50, odometer: 11800, pricePerLitre: 2.1 },
];

test('withDerived sorts and computes cost, distance, consumption', () => {
  const d = withDerived(entries);
  assert.deepEqual(d.map((e) => e.id), ['a', 'b', 'c']);
  assert.equal(d[0].distance, null);
  assert.equal(d[0].consumption, null);
  assert.equal(d[1].distance, 800);
  assert.equal(d[1].consumption, 5);
  assert.equal(d[1].cost, 80);
  assert.equal(d[2].consumption, 5);
});

test('monthly fills empty months', () => {
  const m = monthly(withDerived(entries));
  assert.deepEqual(m.map((x) => x.month), ['2026-01', '2026-02', '2026-03', '2026-04']);
  assert.equal(m[2].litres, 0);
  assert.equal(m[3].cost, 105);
});

test('monthly crosses year boundaries', () => {
  const m = monthly(withDerived([
    { date: '2025-11-30', litres: 1, odometer: 1, pricePerLitre: 1 },
    { date: '2026-02-01', litres: 1, odometer: 2, pricePerLitre: 1 },
  ]));
  assert.deepEqual(m.map((x) => x.month), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('summary totals and averages', () => {
  const s = summary(withDerived(entries));
  assert.equal(s.count, 3);
  assert.equal(s.totalLitres, 135);
  assert.equal(s.totalCost, 85.5 + 80 + 105);
  assert.equal(s.distance, 1800);
  assert.equal(s.avgConsumption, 5); // first fill-up excluded: 90 L / 1800 km
  assert.ok(Math.abs(s.avgPrice - 270.5 / 135) < 1e-9);
});

test('summary of nothing', () => {
  const s = summary([]);
  assert.equal(s.avgConsumption, null);
  assert.equal(s.avgPrice, null);
});

test('filterRange keeps distance derived from entries outside the range', () => {
  const d = filterRange(withDerived(entries), '2026-02-01', null);
  assert.equal(d.length, 2);
  assert.equal(d[0].distance, 800);
});

test('monthComparison', () => {
  const c = monthComparison(withDerived(entries), new Date(2026, 1, 15));
  assert.equal(c.thisMonth, 80);
  assert.equal(c.lastMonth, 85.5);
  const jan = monthComparison(withDerived(entries), new Date(2026, 0, 15));
  assert.equal(jan.lastMonth, 0); // December 2025
});

test('cumulative', () => {
  assert.deepEqual(cumulative(withDerived(entries), 'litres'), [45, 85, 135]);
});

test('validateEntry', () => {
  const ok = { date: '2026-03-01', litres: 30, odometer: 11000, pricePerLitre: 2 };
  assert.equal(validateEntry(ok, entries), null);
  assert.match(validateEntry({ ...ok, odometer: 10800 }, entries), /higher than 10800/);
  assert.match(validateEntry({ ...ok, odometer: 12000 }, entries), /lower than 11800/);
  assert.match(validateEntry({ ...ok, litres: 0 }, entries), /Litres/);
  assert.match(validateEntry({ ...ok, pricePerLitre: NaN }, entries), /Price/);
  assert.match(validateEntry({ ...ok, date: '' }, entries), /date/);
});

test('CSV round trip', () => {
  const { entries: parsed, skipped } = parseCSV(toCSV(entries));
  assert.equal(skipped, 0);
  assert.deepEqual(parsed, withDerived(entries).map(({ date, litres, odometer, pricePerLitre }) =>
    ({ date, litres, odometer, pricePerLitre })));
});

test('parseCSV accepts semicolons with decimal commas and counts bad rows', () => {
  const { entries: parsed, skipped } = parseCSV(
    'date;litres;odometer;price\n2026-01-05;45,5;10000;1,899\n2026-01-09;x;1;1\n'
  );
  assert.deepEqual(parsed, [{ date: '2026-01-05', litres: 45.5, odometer: 10000, pricePerLitre: 1.899 }]);
  assert.equal(skipped, 1);
});

test('toISODate uses local time', () => {
  assert.equal(toISODate(new Date(2026, 10, 10, 23, 59)), '2026-11-10');
});
