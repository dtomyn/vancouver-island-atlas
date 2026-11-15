# Proposed — See the rainstorms themselves

## Intent
As someone worried about what an atmospheric river does to a house, I want to see how hard it has rained at the
weather stations near a place (the wettest days and multi-day storms on record, and whether they are getting
wetter), so that I can judge creeks, culverts and slopes that no river gauge measures.

## Where
A new time layer, **Rainstorms**, under *History on the timeline*, next to *River floods* and *Windstorms*. Also a
Town Report row and a Land Finder tile (nearest long-record station).

## Behaviour (proposed)
- **Map**: each ECCC station with a long daily rain record as a column of that year's wettest 1-day and 3-day
  totals against its own record; rings flare on days over a threshold (say 100 mm in 24 hours).
- **Events**: the storms, by date, joined to the River floods storms (`riverStorms` in `src/highwater.ts`) so one
  panel shows the rain and the rivers' answer to it.
- **Station details**: wettest days on record with dates, days over 50 / 100 mm by decade, the month they fall in.
- **Town Report / Land Finder**: the wettest day and 3-day total on record at the nearest station, and how often.

## Open questions
- Which stations: the `wind` stage already reads ECCC daily files for gust stations; do they carry daily
  precipitation for long enough, or does this need the `climate` stage's station list?
- Is there an open, citable atmospheric-river catalogue (dates and strength at landfall) that can be fetched by a
  stage, so storms can be labelled as atmospheric rivers from data and not by inference?
- Mountain rain is far heavier than at the valley stations; say so, or add a gridded product.

## Touches
`scripts/rain.mjs` (new `rain` stage), `scripts/fetch-data.mjs`, `src/rain.ts` (new layer), `src/highwater.ts`,
`src/metrics.ts`, `src/panels.ts`, `src/land.ts`, `src/sources.ts`, README, `intents/`.
