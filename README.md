# PiggyBank 🐷

A weight & pig-out tracker. Log your weight on a calendar, and stamp a pig on the days
you overdid it — a big pig for a big one, a small pig for a nibble. The Trends view
charts your weight over the month and counts the pigs.

Live: https://pigi-cal.vercel.app

## Running it

It's a plain static site — no build step, no dependencies. Open `index.html`, or serve
the folder with anything:

```sh
python3 -m http.server 8000
```

## Layout

| File | What it is |
| --- | --- |
| `index.html` | Markup for both views plus the weight modal |
| `styles.css` | All styling; the palette lives in `:root` custom properties |
| `app.js` | State, rendering, and the trends chart |
| `assets/` | The two pig stamps |

## Data

Everything is stored locally in the browser under the `pigTracker.v1` localStorage key —
nothing is sent anywhere, and there are no accounts. The shape is:

```js
{ "2026-07-17": { weight: 73.4, stamp: "big", rot: -7 } }
```

`rot` is the stamp's random tilt, kept so a stamp doesn't jump around between renders.
Clearing site data clears your history.

## Deploying

Vercel serves the repo root as-is; pushes to `main` deploy automatically.

## Credits

Design by Claude Design, exported from `Pig Stamp Weight Tracker.zip` and rebuilt here
as a dependency-free static site.
