# 07 — See when the rivers rise

## Intent
As someone looking at waterfront or valley land, I want to see how high each river runs year by year,
so that I can spot flood years and rivers that regularly run far above normal.

## Where
Layer menu → *History on the timeline* → **River floods**.

## Behaviour (as implemented)
- **Map**: each Water Survey of Canada gauge with 8+ years of record (64 of them) is a column whose height is that
  year's highest flow divided by the river's typical annual peak (median); colour ramps from below normal to
  2.5×+. Ripples mark years a river hit 1.5× or more.
- **Panel**: headline numbers for the current year (gauges at 1.5× or more, the biggest relative peak and its river),
  gauges with 8+ years, first year with 3+ gauges; the share of gauges at 1.5×+ per year; the most extreme peaks on
  record; the colour scale; a note that gauges measure flow, not flooded area.
- **Events**: island-wide high-water years (8+ gauges reporting and 40%+ of them at 1.5×+), and **storms**: every
  time 5+ gauges had their yearly peak within a day of each other and 3+ of them ran at 1.5×+ (21 of them, 1961 to
  2020). The November 2021 storm is found the same way and told by the curated *Atmospheric river* moment
  ([04](04-read-the-story-of-a-moment.md)), which lists its gauges.
- **Storm details**: how many rivers peaked, how many ran high, the biggest against normal, days from first peak to
  last; every river that peaked (ratio, m³/s, date), each opening its gauge; the mapped floodplains on those rivers,
  each opening its study ([36](36-know-the-mapped-floodplains.md)); what an atmospheric river is (October–March
  storms only), what the gauges miss, and what to ask about a house.
- **Gauge details** (click a gauge, or a row of the panel's *Most extreme peaks*): normal yearly peak, record and
  its date, years at 1.5×+, share of yearly peaks in October–March, area drained; every year's peak against normal;
  the month of its yearly peak (July to June); its six biggest peaks, those in a listed storm opening that storm;
  the floodplain mapped on its river, or a note that none is (which is not the same as no flooding); its last 20
  years against the years before, where both have 15+ years.
- **Elsewhere**: Town Report names the nearest river and how often it reached 1.5× its normal peak, with a button
  to that gauge's details.

## Limits
High water is not flooding: check regional floodplain maps for a specific property. The panel links to
*Floodplains* ([36](36-know-the-mapped-floodplains.md)), BC's designated floodplain maps.

A storm is read from the rivers, not from rain: the atlas has no rainfall data, so "atmospheric river" is an
explanation in the text, never a label on a storm. Each gauge keeps only its highest flow of the year, so a storm
that was a river's second-highest that year doesn't count it. Creeks, culverts and slopes have no gauges.

## Source
`src/layers.ts` (`riversLayer`), `src/highwater.ts` (`riverStorms`, `describeStorm`, `describeGauge`),
`public/data/rivers.json` from the `rivers` stage.
