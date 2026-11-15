// HIGHWAY CAMERAS — DriveBC's roadside webcams on Vancouver Island (scripts/cameras.mjs builds cameras.json: the list
// of cameras, never their pictures). A static layer: one lens per site on the map; clicking one opens its current
// picture in the side panel, loaded straight from drivebc.ca and reloaded every minute while the panel is open.
// DriveBC's cameras are stills that it replaces every few minutes (most about every 15, the busiest every 5), not video.
import * as d3 from 'd3';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { CamSite, Data, Muni, fmt, km } from './data';
import type { AtlasEvent, AtlasLayer } from './layers';
import { esc } from './html';

type RGBA = [number, number, number, number];
const rgb = (c: string, a = 255): RGBA => { const o = d3.rgb(c); return [o.r, o.g, o.b, a]; };

export const CAM_COLOR = '#fde047';
const RELOAD_MS = 60_000;
const DIR: Record<string, string> = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
const ARROW: Record<string, string> = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖' };

// ids come from the data file as numbers; anything else never reaches a URL
const camId = (id: unknown) => (Number.isInteger(id) && (id as number) > 0 ? (id as number) : 0);
const imageUrl = (id: number) => `https://www.drivebc.ca/images/${camId(id)}.jpg`;
const pageUrl = (id: number) => `https://www.drivebc.ca/cameras/${camId(id)}`;
const hwyName = (h: string) => (/^\d/.test(h) ? `Highway ${h}` : h);
const hwyShort = (h: string) => (/^\d/.test(h) ? `Hwy ${h}` : h);
const views = (s: CamSite) => s.cams.map((c) => (c.dir ? DIR[c.dir] : 'one view')).join(', ');
const nearestMuni = (munis: Muni[], lon: number, lat: number) => munis.reduce((b, m) => { const d = km(lon, lat, m.lon, m.lat); return d < b.d ? { m, d } : b; }, { m: munis[0], d: Infinity });
const where = (data: Data, s: CamSite) => { const n = nearestMuni(data.munis, s.lon, s.lat); return n.d < 2 ? `in ${n.m.name}` : `${Math.round(n.d)} km from ${n.m.name}`; };

/**
 * The live picture: the site's views as tabs, the current image, and a clock that reloads it every minute until the
 * element leaves the page. A new picture is loaded off-screen first, so a failed reload keeps the last good one.
 */
function viewer(el: HTMLElement, site: CamSite) {
  let at = 0, timer = 0, loadedAt: Date | null = null;
  const box = el.appendChild(document.createElement('div'));
  box.className = 'cam-view';
  box.innerHTML = `
    ${site.cams.length > 1 ? `<div class="cam-tabs">${site.cams.map((c, i) => `<button data-i="${i}"${i ? '' : ' class="on"'}>${c.dir ? `${ARROW[c.dir]} ${esc(DIR[c.dir])}` : `View ${i + 1}`}</button>`).join('')}</div>` : ''}
    <a class="cam-frame" target="_blank" rel="noopener"><img alt=""><span class="cam-live"><i></i>Live · DriveBC ↗</span><span class="cam-wait">Loading the picture…</span></a>
    <p class="cam-cap"></p>
    <p class="cam-note" hidden></p>
    <div class="cam-status"><span></span><button class="cam-reload" title="Load the newest picture now">↻ Reload</button></div>`;
  const frame = box.querySelector<HTMLAnchorElement>('.cam-frame')!, img = frame.querySelector('img')!, wait = frame.querySelector<HTMLElement>('.cam-wait')!;
  const status = box.querySelector<HTMLElement>('.cam-status span')!;
  const say = () => { status.textContent = loadedAt ? `Picture loaded ${loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })} · reloads every minute` : ''; };

  const load = () => {
    const cam = site.cams[at], want = at;
    const next = new Image();
    next.onload = () => {
      if (want !== at || !box.isConnected) return;
      img.src = next.src;
      frame.classList.add('ok'); frame.classList.remove('bad');
      loadedAt = new Date(); say();
    };
    next.onerror = () => {
      if (want !== at || !box.isConnected) return;
      // keep a picture that's already showing; say so only when there's nothing to show
      if (!frame.classList.contains('ok')) { frame.classList.add('bad'); wait.textContent = 'DriveBC isn’t sending this picture right now. Open the camera on DriveBC to check.'; }
      else status.textContent = 'Couldn’t reload just now · trying again in a minute';
    };
    // the time on the end only gets past the browser's cache, as DriveBC's own pages do
    next.src = `${imageUrl(cam.id)}?t=${Math.floor(Date.now() / 1000)}`;
  };
  const show = (i: number) => {
    at = i;
    const cam = site.cams[i];
    box.querySelectorAll<HTMLElement>('.cam-tabs button').forEach((b) => b.classList.toggle('on', +b.dataset.i! === i));
    frame.href = pageUrl(cam.id);
    frame.classList.remove('ok', 'bad');
    img.removeAttribute('src');
    img.alt = cam.caption;
    wait.textContent = 'Loading the picture…';
    box.querySelector('.cam-cap')!.textContent = cam.caption;
    const note = box.querySelector<HTMLElement>('.cam-note')!;
    note.hidden = !cam.note; note.textContent = cam.note ?? '';
    loadedAt = null; say();
    load();
  };
  box.querySelectorAll<HTMLElement>('.cam-tabs button').forEach((b) => b.addEventListener('click', () => show(+b.dataset.i!)));
  box.querySelector('.cam-reload')!.addEventListener('click', load);
  show(0);
  timer = window.setInterval(() => {
    if (!box.isConnected) { clearInterval(timer); return; }
    if (!document.hidden) load();
  }, RELOAD_MS);
}

export function camerasLayer(data: Data): AtlasLayer {
  const C = data.cameras;
  const sites = C?.sites ?? [];
  const hwys = [...new Set(sites.map((s) => s.hwy))];
  const hidden = new Set<string>();
  let memo = '', shown: CamSite[] = sites;
  const split = () => { const key = [...hidden].sort().join('|'); if (key !== memo) { memo = key; shown = sites.filter((s) => !hidden.has(s.hwy)); } };
  const nCams = sites.reduce((n, s) => n + s.cams.length, 0);

  const describe = (s: CamSite): AtlasEvent => ({
    layer: 'cameras', kind: `Highway camera · ${hwyName(s.hwy)}`, lon: s.lon, lat: s.lat, zoom: 12.5,
    title: s.name,
    body: `${where(data, s)[0].toUpperCase()}${where(data, s).slice(1)}. ${s.cams.length > 1 ? `${s.cams.length} cameras on one pole, looking ${views(s)}.` : s.cams[0].caption}`,
    stats: [
      { v: hwyShort(s.hwy), l: 'road' },
      { v: String(s.cams.length), l: s.cams.length > 1 ? 'views' : 'view' },
      ...(s.elev != null ? [{ v: `${fmt.int(s.elev)} m`, l: 'above sea level' }] : []),
    ],
    detail: (el) => viewer(el, s),
    sections: [{ title: 'How live is it?', text: 'DriveBC’s cameras take a still picture every few minutes (most about every 15, the busiest every 5); they are not video. The date and time are printed on the picture itself. This panel asks for the newest one every minute while it’s open. A camera in a poor signal area or on solar power can fall hours behind, and at night an unlit road is simply dark.' }],
    sources: s.cams.map((c) => ({ label: `DriveBC${s.cams.length > 1 && c.dir ? ` · ${DIR[c.dir]}` : ''}`, url: pageUrl(c.id) })).slice(0, 4),
    layers: ['cameras'],
  });

  const l: AtlasLayer = {
    id: 'cameras', name: 'Highway cameras', icon: '◉', color: CAM_COLOR,
    range: [new Date().getFullYear(), new Date().getFullYear() + 0.99],
    static: true,
    period: 'the roads right now',
    available: sites.length > 0,
    unavailable: 'The highway camera list hasn’t been built yet. Run <code>npm run data cameras</code>, then reload.',
    build({ focusedId }) {
      if (!C) return [];
      split();
      const f = focusedId === 'cameras', a = f ? 255 : 190, k = f ? 1 : 0.8;
      const out: Layer[] = [
        // a lens: a yellow ring round a dark pupil, a little bigger where one pole carries several cameras
        new ScatterplotLayer<CamSite>({
          id: 'cameras-dots', data: shown,
          getPosition: (s) => [s.lon, s.lat], radiusUnits: 'pixels', getRadius: (s: CamSite) => (s.cams.length > 1 ? 7 : 5.5) * k,
          getFillColor: rgb(CAM_COLOR, a), stroked: true, getLineColor: [6, 10, 18, 220], lineWidthMinPixels: 1.5,
          updateTriggers: { getRadius: k },
          pickable: true, parameters: { depthCompare: 'always' },
        } as any),
        new ScatterplotLayer<CamSite>({
          id: 'cameras-lens', data: shown,
          getPosition: (s) => [s.lon, s.lat], radiusUnits: 'pixels', getRadius: (s: CamSite) => (s.cams.length > 1 ? 3 : 2.2) * k,
          getFillColor: [6, 10, 18, 235],
          updateTriggers: { getRadius: k },
          pickable: false, parameters: { depthCompare: 'always' },
        } as any),
      ];
      return out;
    },
    spark: () => [],
    events: () => [],
    panel(el) {
      if (!C) {
        el.innerHTML = `<div class="kicker" style="--c:${CAM_COLOR}">Highway cameras</div><h2>Highway cameras</h2><div class="unavail">${l.unavailable}</div>`;
        return { update() {} };
      }
      // the island's best-known pinch point opens the panel, so there's a live picture before anything is clicked
      const lead = sites.find((s) => /malahat summit/i.test(s.name)) ?? sites.find((s) => /malahat/i.test(s.name)) ?? sites[0];
      el.innerHTML = `<div class="kicker" style="--c:${CAM_COLOR}">Highway cameras · the roads right now</div>
        <h2>What does the road look like right now?</h2>
        <p class="lede">Every <b>DriveBC roadside camera</b> on Vancouver Island: snow on the Malahat, fog at Sutton Pass, the ferry line-up at Departure Bay. Click a lens on the map, or a name below, for its <b>current picture</b>. A bigger lens is a pole with cameras looking several ways.</p>
        <div class="hero">
          <div class="stat"><div class="v">${fmt.int(nCams)}</div><div class="l">cameras</div></div>
          <div class="stat"><div class="v">${fmt.int(sites.length)}</div><div class="l">places</div></div>
          <div class="stat"><div class="v">${hwys.length}</div><div class="l">roads</div></div>
        </div>
        <h3>Right now: ${esc(lead.name)} <small class="cam-h3">${esc(hwyName(lead.hwy))}</small></h3>
        <div class="cam-lead"></div>
        <h3>Cameras by road, north to south</h3>
        <div class="chips od-chips">${hwys.map((h) => `<button class="chip on" data-h="${esc(h)}" style="--c:${CAM_COLOR}">${esc(hwyShort(h))} <small>${sites.filter((s) => s.hwy === h).length}</small></button>`).join('')}</div>
        ${hwys.map((h) => `<div class="cam-road" data-h="${esc(h)}"><h4>${esc(hwyName(h))}</h4><div class="tr-falls">${sites.map((s, i) => (s.hwy === h ? `<button class="tr-fall cam-go" data-i="${i}"><span class="cam-dot"></span>${esc(s.name)}${s.cams.length > 1 ? ` <small>${s.cams.length} views</small>` : ''}</button>` : '')).join('')}</div></div>`).join('')}
        <p class="note">These are still pictures that DriveBC replaces every few minutes (most about every 15), not video, and they come straight from drivebc.ca each time: the atlas stores only where the cameras are. A camera can be down, behind or pointed elsewhere while operators watch an incident. DriveBC has no cameras on the Gulf Islands or on most side roads. For closures and conditions, use DriveBC itself.</p>
        <div class="source">Source: ${esc(C.source)}. Camera list built ${esc(C.asOf)}; pictures are live.</div>`;
      viewer(el.querySelector<HTMLElement>('.cam-lead')!, lead);
      el.querySelectorAll<HTMLButtonElement>('.od-chips [data-h]').forEach((b) => b.addEventListener('click', () => {
        const h = b.dataset.h!;
        if (hidden.has(h)) hidden.delete(h); else hidden.add(h);
        b.classList.toggle('on', !hidden.has(h));
        el.querySelectorAll<HTMLElement>('.cam-road').forEach((r) => { r.hidden = hidden.has(r.dataset.h!); });
      }));
      // chips keep their state while the layer stays on, so a rebuilt panel starts from it
      el.querySelectorAll<HTMLButtonElement>('.od-chips [data-h]').forEach((b) => b.classList.toggle('on', !hidden.has(b.dataset.h!)));
      el.querySelectorAll<HTMLElement>('.cam-road').forEach((r) => { r.hidden = hidden.has(r.dataset.h!); });
      el.querySelectorAll<HTMLElement>('.cam-go').forEach((b) => b.addEventListener('click', () => window.dispatchEvent(new CustomEvent('atlas:event', { detail: describe(sites[+b.dataset.i!]) }))));
      return { update() {} };
    },
    describe(info: PickingInfo) {
      if (!C || !info.object || info.layer?.id !== 'cameras-dots') return null;
      return describe(info.object as CamSite);
    },
    tooltip(info: PickingInfo) {
      if (!C || !info.object || info.layer?.id !== 'cameras-dots') return null;
      const s = info.object as CamSite;
      const lines: [string, string][] = [['Road', hwyName(s.hwy)], [s.cams.length > 1 ? 'Looking' : 'View', s.cams.length > 1 ? views(s) : s.cams[0].caption], ['Where', where(data, s)]];
      return `<b>${esc(s.name)}</b><br>${lines.map(([k, v]) => `<span class="tk">${esc(k)}</span> <span class="tv">${esc(v)}</span>`).join('<br>')}<br><span class="tk tk-click">Click for the live picture</span>`;
    },
  };
  return l;
}
