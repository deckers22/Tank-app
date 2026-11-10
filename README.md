# Tank

A small fuel log. Add a fill-up (date, litres, odometer, price per litre) and see
statistics: litres and money over time and per month, odometer, fuel consumption,
price per litre, and summary totals.

It is a static web app (PWA): no build step, no server, no account. Data is stored
in the browser on your device (`localStorage`); use **Fill-ups → Export CSV / Import CSV**
to back it up or move it to another device.

## Run locally

```sh
npm start        # serves the folder on http://localhost:8000
npm test         # unit tests for the calculations (Node 20+)
```

## Use on your phone

Host the repository root on any static host over HTTPS (e.g. GitHub Pages:
Settings → Pages → deploy from branch, root folder). Open the URL on your phone and
choose "Add to Home Screen". It then works offline.

## Layout

- `index.html`, `css/style.css` – UI
- `js/stats.js` – pure calculations, validation, CSV (tested in `test/`)
- `js/store.js` – localStorage
- `js/app.js` – form, table, charts
- `sw.js`, `manifest.webmanifest`, `icons/` – offline/installable support
- `vendor/chart.umd.min.js` – Chart.js 4.6.1 (MIT), vendored so the app works offline
- `docs/PROJECT_LOG.md` – running summary of decisions

## Notes

- Fuel consumption per fill-up assumes each fill-up is a full tank.
- CSV columns: `date,litres,odometer,price_per_litre` (date as `YYYY-MM-DD`).
