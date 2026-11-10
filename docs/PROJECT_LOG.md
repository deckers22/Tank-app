# Project log

Lean running summary of the chat, so a new chat can pick up from here.

## Request (2026-11-10)
Fuel log app: add fill-ups (date – default today, litres, odometer, price per litre).
Statistics: litres over time and per month, money spent likewise, mileage over time,
plus suggestions.

## Decisions (answered by the user)
- Form: web app / PWA (later changed to Android APK, see below).
- Storage: on device (localStorage) with CSV export/import. No cloud sync.
- Extra stats: fuel consumption, price-per-litre trend, summary tiles. (Cost per km not chosen.)
- This log lives in the repo as markdown.

## Assumptions (made by Claude, not confirmed)
- Currency €, distance km, UI in English; numbers/dates follow the device locale.
- Every fill-up is a full tank (needed for per-fill-up L/100 km). No "partial fill" flag.
- One car only.
- Odometer must increase with date; the form rejects entries that don't.
- No build step/framework: plain HTML/CSS/JS, Chart.js vendored for offline use.

## Built
- Add/edit/delete fill-ups in a dialog; live total; date defaults to today.
- Statistics tab: period filter (all / last 12 months / this year); tiles (total spent,
  litres, distance, avg consumption, avg price, avg fill-up, this vs last month);
  charts for litres and money (per month / per fill-up / cumulative), odometer,
  consumption, price per litre. Light and dark mode.
- Fill-ups tab: table, CSV export/import (import skips rows with same date + odometer).
- Installable and offline (service worker, network-first).
- Unit tests for calculations: `npm test`.

## Verified
- 12 unit tests pass; browser run (phone + desktop dark) of add, validation, edit,
  delete, export, import, offline reload with no console errors.

## Change: Android (2026-11-10)
User: "App should be android". Answers: wrap the existing app as an APK (not a native
rewrite); get the APK from GitHub (sideload, no Play Store).

- Web files moved to `www/`; Capacitor 8 Android project in `android/`
  (app id `nl.deckers.tank` – chosen by Claude, changing it later means a fresh install).
- CSV export in the Android app goes through the share sheet (Filesystem + Share plugins).
- `.github/workflows/android.yml` builds a debug APK on every push → artifact `tank-apk`.
- Fixed signing key committed (`android/app/debug.keystore`, standard debug password) so
  builds update each other without losing data. Anyone with repo access can sign
  builds with it; fine for personal sideloading, not for Play Store.
- Verified: APK builds locally (min Android 7 / API 24, target API 36), contains the web
  assets, signed with the committed key; web version re-tested in a browser.
- NOT verified: running the APK on a phone/emulator (none available in the build
  environment) – in particular the share-sheet export and CSV import picker.

## Open / ideas
- First thing to check on the phone: Export CSV and Import CSV.
- Possible later: direct .apk download via a GitHub Release, partial-fill flag,
  cost per km, multiple cars, cloud sync, Dutch UI, Play Store release signing.
