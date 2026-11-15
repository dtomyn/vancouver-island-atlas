// HIGH WATER — what the river gauges say about floods, shared by River floods, Floodplains and the Town Report:
// a gauge's own details panel (its record, when in the year it peaks, its biggest peaks, the floodplain mapped on its
// river) and the storms that drove many rivers to their yearly high within a day or two. On this coast those shared
// winter peaks are the mark of an atmospheric river; the atlas has no rain data, so a storm here is read from the
// rivers' answer to it (HYDAT annual peaks and their dates).
import { barChart } from './charts';
import { Data, FloodStudy, MONTHS, RiverStation, floodYear, fmt } from './data';
import type { AtlasEvent, TimedEvent } from './layers';
import { esc } from './html';
import { describeStudy, studyGauges } from './flood';
import * as d3 from 'd3';

export const RIVER_COLOR = '#4cc9f0';
export const ratioColor = d3.scaleLinear<string>().domain([0.4, 1, 1.5, 2.5]).range(['#123a5c', '#1f78b4', '#4cc9f0', '#f1fbff']).clamp(true);

/** A peak at this many times the river's normal annual high counts as high water (the layer's ripple line). */
const HIGH = 1.5;
/** A storm is listed when at least this many gauges peaked in it, and this many of them ran high. */
const STORM_MIN_GAUGES = 5, STORM_MIN_HIGH = 3;
/** Peaks no more than this many days apart belong to the same storm. */
const STORM_GAP_DAYS = 1;
const WATER_OFFICE = (id: string) => `https://wateroffice.ec.gc.ca/report/historical_e.html?stn=${encodeURIComponent(id)}`;

type Hit = { g: RiverStation; ratio: number; date: string };
export type Storm = {
  /** the day most of its rivers peaked, as a fractional year (the same scale as the layer's ripples) */
  t: number; year: number; from: string; to: string; days: number;
  /** the rivers that had their yearly peak in it, biggest against normal first */
  hits: Hit[];
  /** gauges with a peak that year, and how many of this storm's ran at 1.5× normal or more */
  of: number; high: number;
  lon: number; lat: number;
};

const dayNo = (iso: string) => Math.round(Date.parse(iso) / 864e5);
/** "2021-11-15" as a fractional year, on the scale the River floods ripples use. */
export const peakT = (iso: string) => { const d = new Date(iso); return d.getUTCFullYear() + (d.getUTCMonth() + d.getUTCDate() / 31) / 12; };
const dm = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
/** "15–16 Nov 2021", "31 Jan – 2 Feb 2020", "13 Nov 1975". */
export const stormDates = (s: { from: string; to: string }) => {
  const y = s.from.slice(0, 4);
  if (s.from === s.to) return `${dm(s.from)} ${y}`;
  return s.from.slice(5, 7) === s.to.slice(5, 7) ? `${+s.from.slice(8, 10)}–${dm(s.to)} ${y}` : `${dm(s.from)} – ${dm(s.to)} ${y}`;
};
/** "Cowichan River Near Duncan" → "Cowichan River". */
export const riverName = (g: RiverStation) => g.name.split(/ (?:at|near|above|below|headwaters)(?= |$)/i)[0];
const stormSeason = (iso: string) => { const m = +iso.slice(5, 7); return m >= 10 || m <= 3; };

const stormCache = new WeakMap<object, Storm[]>();
/** Every storm in the record that sent 5+ gauged rivers to their yearly peak within a day or two, 3+ of them high. */
export function riverStorms(data: Data): Storm[] {
  const R = data.rivers;
  if (!R) return [];
  const hit = stormCache.get(R);
  if (hit) return hit;
  const all: (Hit & { d: number; y: number })[] = [];
  const perYear: Record<number, number> = {};
  for (const g of R.stations)
    for (const [y, date] of Object.entries(g.peakDates)) {
      if (g.peaks[y] == null || !g.median || !/^\d{4}-\d\d-\d\d$/.test(date)) continue;
      all.push({ g, ratio: g.peaks[y] / g.median, date, d: dayNo(date), y: +y });
      perYear[+y] = (perYear[+y] ?? 0) + 1;
    }
  all.sort((a, b) => a.d - b.d);
  const storms: Storm[] = [];
  let run: typeof all = [];
  const close = () => {
    const high = run.filter((h) => h.ratio >= HIGH);
    if (run.length >= STORM_MIN_GAUGES && high.length >= STORM_MIN_HIGH) {
      // the storm's day: the one most rivers peaked on
      const byDay = d3.rollups(run, (v) => v.length, (h) => h.date).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      const year = +byDay[0][0].slice(0, 4);
      storms.push({
        t: peakT(byDay[0][0]), year, from: run[0].date, to: run.at(-1)!.date, days: run.at(-1)!.d - run[0].d + 1,
        hits: run.map(({ g, ratio, date }) => ({ g, ratio, date })).sort((a, b) => b.ratio - a.ratio),
        of: perYear[year] ?? run.length, high: high.length,
        lon: d3.mean(high, (h) => h.g.lon)!, lat: d3.mean(high, (h) => h.g.lat)!,
      });
    }
    run = [];
  };
  for (const h of all) {
    if (run.length && h.d - run.at(-1)!.d > STORM_GAP_DAYS) close();
    run.push(h);
  }
  if (run.length) close();
  stormCache.set(R, storms);
  return storms;
}

/** The listed storm (if any) a gauge's peak of that year belongs to. */
export const stormOf = (data: Data, g: RiverStation, year: string | number) => riverStorms(data).find((s) => s.hits.some((h) => h.g === g && h.date === g.peakDates[year]));
/** The storm on or about a date (a curated event's), if the gauges recorded one. */
export const stormNear = (data: Data, t: number) => riverStorms(data).find((s) => Math.abs(s.t - t) < 0.03);
/** The floodplain studies whose rivers this gauge measures. */
export const studiesFor = (data: Data, g: RiverStation): FloodStudy[] => (data.flood?.studies ?? []).filter((s) => studyGauges(data, s).includes(g));

const open = (ev: AtlasEvent) => window.dispatchEvent(new CustomEvent('atlas:event', { detail: ev }));
/** A list of rows in an event's panel, each opening another details panel (or plain where there is nothing to open). */
function rows(el: HTMLElement, title: string, items: { head: string; sub: string; color: string; ev?: () => AtlasEvent }[], note?: string) {
  if (!items.length) return;
  el.insertAdjacentHTML('beforeend', `<h3>${esc(title)}</h3>`);
  const box = el.appendChild(document.createElement('div'));
  box.className = 'ev-list hw-list';
  box.innerHTML = items.map((it, i) => `<button class="ev-item" data-i="${i}" style="--c:${it.color}"${it.ev ? '' : ' disabled'}><span class="ev-dot"></span><span><b>${esc(it.head)}</b><small>${esc(it.sub)}</small></span><span class="ev-go">${it.ev ? '›' : ''}</span></button>`).join('');
  box.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.addEventListener('click', () => { const ev = items[+b.dataset.i!].ev; if (ev) open(ev()); }));
  if (note) el.insertAdjacentHTML('beforeend', `<p class="note">${esc(note)}</p>`);
}

/** Buttons to the floodplain maps on a set of gauges' rivers. */
function studyRows(el: HTMLElement, data: Data, gauges: RiverStation[], title: string) {
  const studies = [...new Set(gauges.flatMap((g) => studiesFor(data, g)))];
  rows(el, title, studies.map((s) => ({
    head: `${s.name} floodplain`, sub: `mapped ${floodYear(s) ?? 'undated'} · ${fmt.ha(s.ha)} · the ground BC drew as flooding in a 200-year flood`, color: '#5b8cff',
    ev: () => describeStudy(data, s),
  })));
  return studies.length;
}

/** The gauges of a storm, biggest against normal first, each opening its own record; then the floodplains on those rivers. */
export function stormDetail(data: Data, s: Storm) {
  return (el: HTMLElement) => {
    rows(el, `The rivers that peaked, ${stormDates(s)}`, s.hits.map((h) => ({
      head: `${h.ratio.toFixed(1)}× · ${h.g.name}`,
      sub: `${fmt.int(h.g.peaks[s.year])} m³/s on ${dm(h.date)}, against a normal yearly peak of ${fmt.int(h.g.median)}${h.ratio >= HIGH ? ' · high water' : ''}`,
      color: ratioColor(h.ratio), ev: () => describeGauge(data, h.g),
    })), 'Times its normal yearly peak. Click a river for its whole record.');
    studyRows(el, data, s.hits.filter((h) => h.ratio >= 1).map((h) => h.g), 'Mapped floodplains on these rivers');
  };
}
/** A storm's headline numbers. */
export const stormStats = (s: Storm) => [
  { v: `${s.hits.length} of ${s.of}`, l: `gauged rivers at their ${s.year} peak` },
  { v: String(s.high), l: 'at 1.5× their normal peak or more' },
  { v: `${s.hits[0].ratio.toFixed(1)}×`, l: `${riverName(s.hits[0].g)}, the most against normal` },
];

const stormEvents = new WeakMap<Storm, TimedEvent>();
/** A storm a curated event already tells (November 2021): its peaks open that story instead of a second one. */
export const tellStormWith = (s: Storm, ev: TimedEvent) => { stormEvents.set(s, ev); };
/** A storm as a timeline moment on River floods. */
export function describeStorm(data: Data, s: Storm): TimedEvent {
  const had = stormEvents.get(s);
  if (had) return had;
  const n = s.hits.length;
  const ev: TimedEvent = {
    t: s.t, layer: 'rivers', kind: 'Storm · rivers in flood', lon: s.lon, lat: s.lat, zoom: 7.6,
    title: `${stormDates(s)}: ${n} rivers peak in one storm`,
    body: `${n} of the ${s.of} gauged rivers had their highest flow of ${s.year} ${s.days > 1 ? `within ${s.days} days of each other` : 'on the same day'}, and ${s.high} of them ran at 1.5× their normal yearly peak or more.`,
    stats: [...stormStats(s), { v: s.days > 1 ? `${s.days} days` : '1 day', l: 'from the first peak to the last' }],
    detail: stormDetail(data, s),
    sections: [
      ...(stormSeason(s.from) ? [{ title: 'The mark of an atmospheric river', text: 'When rivers across the island reach their yearly high within a day or two in the storm season, one large rainstorm did it. On this coast those are usually atmospheric rivers: long, narrow bands of very moist air from the subtropics that rain hard on the mountains for a day or more, sometimes melting snow as they go. The atlas has river gauges, not rain gauges, so this is the rivers’ answer to the storm, not a measurement of the storm itself.' }] : []),
      { title: 'What the gauges miss', text: 'Each gauge keeps only its single highest flow of the year, so a river that ran high in this storm but higher in another the same year is not counted here. Creeks, ditches and culverts have no gauges at all, and in a storm like this they, along with slides and washed-out roads, do much of the damage to houses.' },
      { title: 'If you are looking at a house', text: 'Open a river above for its full record and the months it floods, then its mapped floodplain where the province drew one. Ask the regional district for the flood construction level, ask the seller and neighbours what happened in this storm, and look at how the lot drains: a culvert, a creek at the back, or a slope above it.' },
    ],
    sources: [{ label: 'Water Survey of Canada historical data (Water Office)', url: 'https://wateroffice.ec.gc.ca/' }],
    layers: ['rivers', 'flood'],
  };
  stormEvents.set(s, ev);
  return ev;
}

/** The details panel for one river gauge. */
export function describeGauge(data: Data, g: RiverStation): AtlasEvent {
  const years = Object.keys(g.peaks).map(Number).sort((a, b) => a - b);
  const r = (y: number) => g.peaks[y] / g.median;
  const rec = years.reduce((a, y) => (g.peaks[y] > g.peaks[a] ? y : a), years[0]);
  const high = years.filter((y) => r(y) >= HIGH);
  const dated = years.filter((y) => g.peakDates[y]);
  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const y of dated) byMonth[+g.peakDates[y].slice(5, 7) - 1]++;
  const winter = dated.filter((y) => stormSeason(g.peakDates[y])).length;
  const top = [...years].sort((a, b) => g.peaks[b] - g.peaks[a]).slice(0, 6);
  const shared = dated.filter((y) => stormOf(data, g, y)).length;
  const studies = studiesFor(data, g);
  // the last 20 years of record against the years before, where both are long enough to compare
  const recent = years.filter((y) => y > years.at(-1)! - 20), older = years.filter((y) => y <= years.at(-1)! - 20);
  const hi = (ys: number[]) => ys.filter((y) => r(y) >= HIGH).length;
  return {
    layer: 'rivers', kind: 'River gauge', lon: g.lon, lat: g.lat, zoom: 9.5,
    title: g.name,
    body: `Water Survey of Canada gauge ${g.id}, ${years.length} years of record (${years[0]}–${years.at(-1)}). Each bar is a year’s highest flow against the river’s normal yearly peak.`,
    stats: [
      { v: `${fmt.int(g.median)} m³/s`, l: 'normal yearly peak' },
      { v: `${r(rec).toFixed(1)}×`, l: `record, ${g.peakDates[rec] ? `${dm(g.peakDates[rec])} ` : ''}${rec}` },
      { v: `${high.length} of ${years.length}`, l: 'years at 1.5× normal or more' },
      ...(dated.length ? [{ v: `${Math.round((winter / dated.length) * 100)}%`, l: 'of yearly peaks fall October–March' }] : []),
      ...(g.area ? [{ v: `${fmt.int(g.area)} km²`, l: 'drains' }] : []),
    ],
    detail: (el) => {
      el.insertAdjacentHTML('beforeend', '<h3>Peak flow each year, against normal</h3>');
      const box = el.appendChild(document.createElement('div'));
      box.className = 'ev-chart';
      requestAnimationFrame(() => barChart(box, {
        data: years.map((y) => ({ x: y, y: r(y), color: ratioColor(r(y)) })), xDomain: [years[0], years.at(-1)!], color: RIVER_COLOR, height: 120,
        yFormat: (v) => `${v.toFixed(1)}×`,
        tooltip: (d) => `<b>${d.x}</b> · ${d.y.toFixed(2)}× normal<br>${fmt.int(g.peaks[d.x])} m³/s${g.peakDates[d.x] ? ` on ${dm(g.peakDates[d.x])}` : ''}`,
      }));
      if (dated.length) {
        // July to June, so the storm season sits in the middle
        const order = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5], max = Math.max(...byMonth);
        el.insertAdjacentHTML('beforeend', `<h3>The month of its yearly peak</h3>
          <div class="hw-months">${order.map((m) => `<div title="${MONTHS[m]}: ${byMonth[m]} of ${dated.length} years"><i style="height:${Math.round((byMonth[m] / max) * 100)}%"></i><span>${MONTHS[m][0]}</span></div>`).join('')}</div>`);
      }
      rows(el, 'Its biggest peaks', top.map((y) => {
        const s = g.peakDates[y] ? stormOf(data, g, y) : undefined;
        return {
          head: `${r(y).toFixed(1)}× · ${g.peakDates[y] ? `${dm(g.peakDates[y])} ` : ''}${y}`,
          sub: `${fmt.int(g.peaks[y])} m³/s${s ? ` · one storm with ${s.hits.length - 1} other rivers` : ''}`,
          color: ratioColor(r(y)), ev: s ? () => describeStorm(data, s) : undefined,
        };
      }), top.some((y) => g.peakDates[y] && stormOf(data, g, y)) ? 'A peak shared with other rivers opens that storm.' : undefined);
      if (!studyRows(el, data, [g], 'The mapped floodplain on this river') && data.flood)
        el.insertAdjacentHTML('beforeend', '<h3>Mapped floodplain</h3><p class="note">None of BC’s floodplain maps is matched to this gauge. Only 17 island rivers and lakes were ever mapped: no map is not the same as no flooding.</p>');
    },
    sections: [
      ...(dated.length >= 8 && winter / dated.length >= 0.7 ? [{ title: 'A storm-fed river', text: `${winter} of its ${dated.length} yearly peaks came between October and March, the season of Pacific storms, and ${shared} of them in storms that peaked five or more island rivers at once. The biggest of those on this coast are atmospheric rivers: bands of very moist air that rain on the mountains for a day or more. A river like this rises within hours of the rain and falls nearly as fast.` }] : []),
      ...(recent.length >= 15 && older.length >= 15 ? [{ title: 'Lately', text: `In its last 20 years of record (${recent[0]}–${recent.at(-1)}), ${hi(recent)} of ${recent.length} yearly peaks reached 1.5× normal or more, against ${hi(older)} of ${older.length} in the years before. One gauge is a small sample: read it with its neighbours.` }] : []),
      { title: 'For a property near this river', text: 'A gauge measures the flow at one spot, not which ground goes under. A high ratio means the river ran far above its usual winter high; whether that reaches a house depends on the banks, the dikes and the height of the land. Check the mapped floodplain where there is one, ask the regional district for the flood construction level, and remember that small creeks and culverts flood in the same storms with no gauge to record it.' },
    ],
    sources: [{ label: `Water Survey of Canada: ${g.id} on the Water Office`, url: WATER_OFFICE(g.id) }],
    layers: studies.length ? ['rivers', 'flood'] : ['rivers'],
  };
}
