# Tank

A small fuel log. Add a fill-up (date, litres, odometer, price per litre) and see
statistics: litres and money over time and per month, odometer, fuel consumption,
price per litre, and summary totals.

It is a static web app wrapped as an Android app with [Capacitor](https://capacitorjs.com).
No server, no account: data is stored on the device. Use **Fill-ups → Export CSV /
Import CSV** to back it up or move it to another phone.

## Get the Android app

Every push runs the **Android APK** workflow (`.github/workflows/android.yml`).
On GitHub: Actions → latest "Android APK" run → Artifacts → `tank-apk`. Unzip it on
your phone, open `app-debug.apk` and allow installing from that source.

Later builds install as an update over the previous one and keep your data, because
all builds are signed with the same key (`android/app/debug.keystore`).
Uninstalling the app deletes its data, so export a CSV first.

## Develop

```sh
npm install
npm start            # web version on http://localhost:8000
npm test             # unit tests for the calculations
npm run android:apk  # build android/app/build/outputs/apk/debug/app-debug.apk
                     # (needs JDK 21 and the Android SDK, ANDROID_HOME set)
```

## Layout

- `www/` – the app itself (everything below is inside it)
- `index.html`, `css/style.css` – UI
- `js/stats.js` – pure calculations, validation, CSV (tested in `test/`)
- `js/store.js` – localStorage
- `js/app.js` – form, table, charts
- `sw.js`, `manifest.webmanifest`, `icons/` – offline/installable support for the web version
- `android/`, `capacitor.config.json` – Android wrapper (web files are copied in by `cap sync`)
- `vendor/chart.umd.min.js` – Chart.js 4.6.1 (MIT), vendored so the app works offline
- `docs/PROJECT_LOG.md` – running summary of decisions

## Notes

- Fuel consumption per fill-up assumes each fill-up is a full tank.
- CSV columns: `date,litres,odometer,price_per_litre` (date as `YYYY-MM-DD`).
