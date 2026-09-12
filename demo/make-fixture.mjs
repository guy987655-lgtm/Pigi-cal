// Regenerates demo/fixture.json — the made-up month shown at /?demo=1.
// Everything here is invented (persona "Dana Cohen"); nothing is derived from a real log.
//   node demo/make-fixture.mjs
import { writeFileSync } from "node:fs";

// Small seeded PRNG (mulberry32) so the fixture is identical on every run.
let seed = 20260627;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);

const YEAR = 2026, MONTH = 6, LAST_DAY = 27; // June 2026, "today" = the 27th
const START_KG = 68.4, END_KG = 66.9;
const skipped = new Set([6, 13, 14, 20, 24]);           // days with no weigh-in
const bigPig = new Set([6, 13, 20]);                     // Saturdays
const smallPig = new Set([2, 10, 17, 25]);
const gym = new Set([1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26]);

const days = {};
for (let d = 1; d <= LAST_DAY; d++) {
  const key = `${YEAR}-${String(MONTH).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const trend = START_KG + ((END_KG - START_KG) * (d - 1)) / (LAST_DAY - 1);
  const bump = bigPig.has(d - 1) ? 0.4 : smallPig.has(d - 1) ? 0.2 : 0; // the morning after
  const weight = skipped.has(d) ? null : Math.round((trend + bump + between(-0.25, 0.25)) * 10) / 10;
  const stamp = bigPig.has(d) ? "big" : smallPig.has(d) ? "small" : null;
  const tilt = Math.round(6 + rand() * 8);
  const entry = {
    weight,
    stamp,
    rot: stamp === "big" ? -tilt : stamp === "small" ? tilt : 0,
    gym: gym.has(d),
    gymRot: gym.has(d) ? Math.round(between(-10, 10)) : 0,
  };
  if (entry.weight !== null || entry.stamp || entry.gym) days[key] = entry;
}

const fixture = {
  _comment: "Demo-mode month for PiggyBank (?demo=1). Invented for the portfolio persona 'Dana Cohen'. Regenerate with node demo/make-fixture.mjs.",
  demoNow: "2026-06-27T19:30:00+03:00",
  days,
};
writeFileSync(new URL("./fixture.json", import.meta.url), JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${Object.keys(days).length} days`);
