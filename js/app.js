import { loadEntries, saveEntries, newId } from './store.js';
import {
  toISODate, dateToTime, withDerived, filterRange, monthly, summary,
  monthComparison, cumulative, validateEntry, toCSV, parseCSV,
} from './stats.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---- State ----
let entries = loadEntries();
let range = 'all';
const modes = { litres: 'month', cost: 'month' };
let editingId = null;
const charts = {};

// ---- Formatting ----
const nf = (digits) => new Intl.NumberFormat(undefined, {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const fmt0 = nf(0), fmt1 = nf(1), fmt2 = nf(2), fmt3 = nf(3);
const fmtAxis = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const eur = (v) => `€ ${fmt2.format(v)}`;
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' });
const fmtDate = (iso) => dateFmt.format(dateToTime(iso));
const fmtMonth = (key) => monthFmt.format(dateToTime(`${key}-01`));

// ---- Navigation ----
$$('.tabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    $$('.tabs button').forEach((b) => b.removeAttribute('aria-current'));
    btn.setAttribute('aria-current', 'page');
    $$('.view').forEach((v) => (v.hidden = v.id !== `view-${btn.dataset.view}`));
    if (btn.dataset.view === 'stats') renderStats(); // charts need a visible canvas
  })
);

$$('.filters .chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    range = chip.dataset.range;
    $$('.filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    renderStats();
  })
);

$$('.seg').forEach((seg) =>
  seg.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    modes[seg.dataset.chart] = btn.dataset.mode;
    [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    renderStats();
  })
);

// ---- Entry dialog ----
const dialog = $('#entry-dialog');
const fDate = $('#f-date'), fLitres = $('#f-litres'), fOdo = $('#f-odo'), fPrice = $('#f-price');

function openDialog(entry = null) {
  editingId = entry?.id ?? null;
  $('#dialog-title').textContent = entry ? 'Edit fill-up' : 'Add fill-up';
  $('#f-delete').hidden = !entry;
  $('#f-error').hidden = true;
  fDate.value = entry?.date ?? toISODate(new Date()); // default: today
  fLitres.value = entry?.litres ?? '';
  fOdo.value = entry?.odometer ?? '';
  fPrice.value = entry?.pricePerLitre ?? '';
  const last = withDerived(entries).pop();
  fOdo.placeholder = last ? `last: ${last.odometer}` : '';
  fPrice.placeholder = last ? `last: ${last.pricePerLitre}` : 'e.g. 1.899';
  updateTotal();
  dialog.showModal();
  (entry ? fDate : fLitres).focus();
}

function updateTotal() {
  const total = fLitres.valueAsNumber * fPrice.valueAsNumber;
  $('#f-total').textContent = total > 0 ? eur(total) : '–';
}
[fLitres, fPrice].forEach((el) => el.addEventListener('input', updateTotal));

$('#add-btn').addEventListener('click', () => openDialog());
$('#f-cancel').addEventListener('click', () => dialog.close());

$('#entry-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const candidate = {
    id: editingId ?? newId(),
    date: fDate.value,
    litres: fLitres.valueAsNumber,
    odometer: fOdo.valueAsNumber,
    pricePerLitre: fPrice.valueAsNumber,
  };
  const others = entries.filter((e) => e.id !== candidate.id);
  const error = validateEntry(candidate, others);
  if (error) {
    $('#f-error').textContent = error;
    $('#f-error').hidden = false;
    return;
  }
  entries = [...others, candidate];
  commit(editingId ? 'Fill-up updated.' : 'Fill-up added.');
  dialog.close();
});

$('#f-delete').addEventListener('click', () => {
  if (!confirm('Delete this fill-up?')) return;
  entries = entries.filter((e) => e.id !== editingId);
  commit('Fill-up deleted.');
  dialog.close();
});

function commit(message) {
  saveEntries(entries);
  render();
  toast(message);
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

// ---- Export / import ----
$('#export-btn').addEventListener('click', () => {
  if (!entries.length) return toast('Nothing to export yet.');
  const url = URL.createObjectURL(new Blob([toCSV(entries)], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), {
    href: url, download: `tank-${toISODate(new Date())}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
});

$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const { entries: parsed, skipped } = parseCSV(await file.text());
  // Skip rows already present (same date and odometer).
  const seen = new Set(entries.map((e) => `${e.date}|${e.odometer}`));
  const fresh = parsed.filter((e) => {
    const key = `${e.date}|${e.odometer}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  entries = [...entries, ...fresh.map((e) => ({ id: newId(), ...e }))];
  const dupes = parsed.length - fresh.length;
  commit(
    `Imported ${fresh.length} fill-up${fresh.length === 1 ? '' : 's'}` +
    (dupes ? `, ${dupes} already present` : '') +
    (skipped ? `, ${skipped} invalid row${skipped === 1 ? '' : 's'} skipped` : '') + '.'
  );
});

// ---- Rendering ----
function render() {
  renderEntries();
  if (!$('#view-stats').hidden) renderStats();
}

function renderEntries() {
  const rows = withDerived(entries).reverse(); // newest first
  $('#entries-empty').hidden = rows.length > 0;
  $('.table-wrap').hidden = rows.length === 0;
  const tbody = $('#entries-table tbody');
  tbody.replaceChildren(
    ...rows.map((e) => {
      const tr = document.createElement('tr');
      const cell = (text, cls) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (cls) td.className = cls;
        tr.append(td);
      };
      cell(fmtDate(e.date));
      cell(fmt2.format(e.litres), 'num');
      cell(fmt0.format(e.odometer), 'num');
      cell(fmt3.format(e.pricePerLitre), 'num');
      cell(eur(e.cost), 'num');
      cell(e.consumption == null ? '–' : fmt1.format(e.consumption), 'num');
      const td = document.createElement('td');
      const btn = Object.assign(document.createElement('button'), {
        type: 'button', className: 'btn', textContent: 'Edit',
      });
      btn.setAttribute('aria-label', `Edit fill-up of ${fmtDate(e.date)}`);
      btn.addEventListener('click', () => openDialog(e));
      td.append(btn);
      tr.append(td);
      return tr;
    })
  );
}

function rangeBounds() {
  const now = new Date();
  if (range === '12m')
    return [toISODate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)), null];
  if (range === 'year') return [`${now.getFullYear()}-01-01`, null];
  return [null, null];
}

function renderTiles(inRange, all) {
  const s = summary(inRange);
  const cmp = monthComparison(all);
  const tiles = [
    ['Total spent', eur(s.totalCost), `${s.count} fill-up${s.count === 1 ? '' : 's'}`],
    ['Total litres', fmt0.format(s.totalLitres), 'L'],
    ['Distance driven', fmt0.format(s.distance), 'km between fill-ups'],
    ['Avg consumption', s.avgConsumption == null ? '–' : fmt1.format(s.avgConsumption), 'L/100 km'],
    ['Avg price', s.avgPrice == null ? '–' : `€ ${fmt3.format(s.avgPrice)}`, 'per litre'],
    ['Avg fill-up', s.avgFillCost == null ? '–' : eur(s.avgFillCost), 'per visit'],
    ['This month', eur(cmp.thisMonth), `last month ${eur(cmp.lastMonth)}`],
  ];
  $('#tiles').replaceChildren(
    ...tiles.map(([label, value, hint]) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      for (const [cls, text] of [['label', label], ['value', value], ['hint', hint]]) {
        const div = document.createElement('div');
        div.className = cls;
        div.textContent = text;
        tile.append(div);
      }
      return tile;
    })
  );
}

function renderStats() {
  const all = withDerived(entries);
  $('#stats-empty').hidden = all.length > 0;
  $('#stats-body').hidden = all.length === 0;
  if (!all.length) return;

  const inRange = filterRange(all, ...rangeBounds());
  renderTiles(inRange, all);

  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();
  const months = monthly(inRange);
  const points = (values) => inRange.map((e, i) => ({ x: dateToTime(e.date), y: values[i] }));

  const subs = {
    month: (unit) => `${unit} per calendar month`,
    fill: (unit) => `${unit} at each fill-up`,
    cum: (unit) => `Running total, ${unit.toLowerCase()}`,
  };
  $('#litres-sub').textContent = subs[modes.litres]('Litres');
  $('#cost-sub').textContent = subs[modes.cost]('Euros');

  const measure = (key, field, colorVar, format) => {
    const mode = modes[key];
    if (mode === 'month')
      return barChart(`chart-${key}`, months.map((m) => fmtMonth(m.month)),
        months.map((m) => m[field]), color(colorVar), format);
    const values = mode === 'cum' ? cumulative(inRange, field) : inRange.map((e) => e[field]);
    return lineChart(`chart-${key}`, points(values), color(colorVar), format, { zero: true });
  };
  measure('litres', 'litres', '--series-litres', (v) => `${fmt1.format(v)} L`);
  measure('cost', 'cost', '--series-cost', eur);

  lineChart('chart-odo', points(inRange.map((e) => e.odometer)), color('--series-odo'),
    (v) => `${fmt0.format(v)} km`);

  const cons = inRange.filter((e) => e.consumption != null);
  $('#cons-note').hidden = cons.length > 0;
  $('#chart-cons').parentElement.hidden = cons.length === 0;
  if (cons.length)
    lineChart('chart-cons', cons.map((e) => ({ x: dateToTime(e.date), y: e.consumption })),
      color('--series-cons'), (v) => `${fmt1.format(v)} L/100 km`);

  lineChart('chart-price', points(inRange.map((e) => e.pricePerLitre)), color('--series-price'),
    (v) => `€ ${fmt3.format(v)}`);
}

// ---- Charts (Chart.js) ----
function baseOptions(format, css) {
  const grid = css.getPropertyValue('--grid').trim();
  const muted = css.getPropertyValue('--text-muted').trim();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false }, // one series per chart; the card title names it
      tooltip: { displayColors: false, callbacks: { label: (ctx) => format(ctx.parsed.y) } },
    },
    scales: {
      x: { grid: { display: false }, border: { color: grid }, ticks: { color: muted, maxRotation: 0 } },
      y: {
        grid: { color: grid }, border: { display: false },
        ticks: { color: muted, maxTicksLimit: 6, callback: (v) => fmtAxis.format(v) },
      },
    },
  };
}

function draw(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function barChart(id, labels, values, color, format) {
  const options = baseOptions(format, getComputedStyle(document.documentElement));
  options.scales.x.ticks.autoSkip = true;
  options.scales.x.ticks.maxTicksLimit = 8;
  options.scales.y.beginAtZero = true;
  draw(id, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 4, maxBarThickness: 28 }] },
    options,
  });
}

function lineChart(id, data, color, format, { zero = false } = {}) {
  const css = getComputedStyle(document.documentElement);
  const options = baseOptions(format, css);
  options.scales.y.beginAtZero = zero;
  // Time on a linear axis (avoids needing a date adapter): ticks at month starts.
  const day = 864e5;
  const min = data[0].x, max = data[data.length - 1].x;
  Object.assign(options.scales.x, {
    type: 'linear',
    min: min === max ? min - 15 * day : min,
    max: min === max ? max + 15 * day : max,
    afterBuildTicks(axis) {
      const ticks = [];
      const d = new Date(axis.min);
      d.setDate(1); d.setHours(0, 0, 0, 0);
      if (d.getTime() < axis.min) d.setMonth(d.getMonth() + 1);
      for (; d.getTime() <= axis.max; d.setMonth(d.getMonth() + 1)) ticks.push({ value: d.getTime() });
      const step = Math.ceil(ticks.length / 6) || 1;
      axis.ticks = ticks.filter((_, i) => i % step === 0);
    },
  });
  options.scales.x.ticks.callback = (v) => monthFmt.format(v);
  options.plugins.tooltip.callbacks.title = (items) => dateFmt.format(items[0].parsed.x);
  draw(id, {
    type: 'line',
    data: {
      datasets: [{
        data, borderColor: color, backgroundColor: color, borderWidth: 2,
        pointRadius: data.length > 40 ? 0 : 4, pointHoverRadius: 6,
        pointBorderColor: css.getPropertyValue('--surface-1').trim(), pointBorderWidth: 2,
        tension: 0, clip: 8,
      }],
    },
    options,
  });
}

// Re-read colours when the OS theme flips.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
