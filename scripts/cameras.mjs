// Highway cameras: where DriveBC's roadside webcams are on Vancouver Island and what each one looks at. Run as the
// `cameras` stage of fetch-data.mjs.
//
// Source: "DriveBC HighwayCams" in the BC Data Catalogue (BC Ministry of Transportation and Transit), Open Government
// Licence – British Columbia: one CSV row per camera with its name, caption, highway, direction, position and the
// address of its current picture. Only the list is stored here; the pictures themselves are never downloaded: the
// app shows them straight from drivebc.ca when a camera is opened.
//
// Cameras that share a pole (the CSV's cam_group) become one site with several views.
//
// Writes cameras.json: { source, asOf, sites: [{ name, hwy, lon, lat, elev, cams: [{ id, dir, caption, note? }] }] }.

const CSV = 'https://catalogue.data.gov.bc.ca/dataset/6b39a910-6c77-476f-ac96-7b4f18849b1c/resource/a9d52d85-8402-4ce7-b2ac-a2779837c48a/download/webcams.csv';
const DIRS = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

const parseLine = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, -1).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());

export async function buildCameras(h) {
  const { log, cached, fetchBuf, writeOut, round } = h;
  const text = (await cached('cameras/webcams.csv', () => fetchBuf(CSV))).toString('utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = parseLine(lines[0]);
  for (const col of ['id', 'cam_group', 'camName', 'highway_number', 'caption', 'region_name', 'orientation', 'latitude', 'longitude']) {
    if (!head.includes(col)) throw new Error(`DriveBC webcam list has no "${col}" column (columns: ${head.join(', ')})`);
  }
  const all = lines.slice(1).map((l) => Object.fromEntries(parseLine(l).map((v, i) => [head[i], v])));
  // DriveBC's own "Vancouver Island" region: the island's highways, none of the mainland ones inside the atlas's box
  const rows = all.filter((r) => r.region_name === 'Vancouver Island' && /^\d+$/.test(r.id) && Number.isFinite(+r.latitude) && Number.isFinite(+r.longitude));
  if (!rows.length) throw new Error('no Vancouver Island cameras in the DriveBC webcam list');

  const groups = new Map();
  for (const r of rows) {
    const g = r.cam_group || r.id;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const bare = (name) => name.replace(/\s+-\s+(N|NE|E|SE|S|SW|W|NW)$/i, '').trim();
  const sites = [...groups.entries()].map(([g, cams]) => {
    cams.sort((a, b) => +a.id - +b.id);
    const lead = cams.find((c) => c.id === g) ?? cams[0];
    return {
      name: bare(lead.camName),
      hwy: lead.highway_number,
      lon: round(+lead.longitude, 5), lat: round(+lead.latitude, 5),
      elev: Number.isFinite(+lead.elevation) && lead.elevation !== '' ? Math.round(+lead.elevation) : null,
      cams: cams.map((c) => ({
        id: +c.id,
        dir: DIRS.has(c.orientation) ? c.orientation : null,
        caption: c.caption,
        ...(c.credit ? { note: c.credit } : {}),
      })),
    };
  });
  // highway by highway (numbered ones first, in order), each from north to south
  const hwyKey = (s) => { const m = /^(\d+)([A-Z]?)$/.exec(s.hwy); return m ? [+m[1], m[2]] : [999, s.hwy]; };
  sites.sort((a, b) => hwyKey(a)[0] - hwyKey(b)[0] || String(hwyKey(a)[1]).localeCompare(String(hwyKey(b)[1])) || b.lat - a.lat);

  log(`  ${rows.length} cameras at ${sites.length} sites on ${new Set(sites.map((s) => s.hwy)).size} highways (of ${all.length} in BC)`);
  await writeOut('cameras', {
    source: 'DriveBC HighwayCams (BC Ministry of Transportation and Transit), BC Data Catalogue',
    asOf: new Date().toISOString().slice(0, 10),
    sites,
  });
}
