# 43 — See the roads right now

## Intent
As someone weighing a town (or about to drive to one), I want to see the highway cameras on the map and open any
camera's current picture, so that I can see what the road, the weather and the traffic are like there right now.

## Where
- Layer menu → *Towns & living* → **Highway cameras**. A static layer.
- Data & sources → **Highway cameras**.

## Inputs & controls
| Control | Effect |
|---|---|
| Hover a lens on the map | Tooltip: the place, its road, which ways its cameras look, the nearest town. |
| Click a lens | Details panel with the **current picture**, road, number of views, elevation, closest towns and links to DriveBC. |
| Direction tabs above the picture (↑ north, ↓ south…) | Switch between the cameras on that pole. Shown only where there are several. |
| **↻ Reload** | Asks DriveBC for the newest picture now. |
| Click the picture | Opens that camera's page on DriveBC in a new tab. |
| Road chips in the layer panel (Hwy 1, Hwy 19…) | Show or hide that road's cameras on the map and in the list. |
| Click a name in the layer panel's list | Opens that camera's details panel and flies there. |

## Behaviour (as implemented)
- The `cameras` stage reads BC's open *DriveBC HighwayCams* list, keeps the cameras DriveBC files under its Vancouver
  Island region, and groups those sharing a pole (`cam_group`) into one site. It stores each camera's id, direction,
  caption and any DriveBC remark: **never a picture**.
- On the map each site is a yellow lens, bigger where a pole carries more than one camera.
- A picture is loaded by the browser straight from `www.drivebc.ca/images/{id}.jpg` when a camera is opened, and
  again **every minute** while the panel stays open (not while the browser tab is hidden). A reload that fails keeps
  the last good picture and says so; a camera that sends nothing shows a message pointing to DriveBC.
- The layer's own panel opens with a live picture from Malahat Summit, then lists every site by road, north to south.
- The panel says when the picture was loaded. When it was *taken* is printed on the picture by DriveBC.

## Acceptance criteria
- About 180 cameras at about 76 sites on 9 roads (Highways 1, 4, 14, 17, 18, 19, 19A, 28 and South Cowichan Lake).
- Opening a site with several cameras shows one tab per direction; switching tabs changes the picture, the caption
  and the DriveBC link.
- No request goes to `drivebc.ca` until the Highway cameras layer is picked or a camera is opened, and none after the
  panel is closed.
- No camera picture is written to `public/data` or `.cache`.
- Without `cameras.json` the layer says to run `npm run data cameras`.

## Limits
- DriveBC's cameras are **stills replaced every few minutes** (most about every 15, the busiest every 5), not video.
  A camera can be down, hours behind (solar power, poor signal), dark at night, or turned by operators.
- The atlas can't tell a stale picture from a fresh one; the time stamp on the picture is the only sign.
- DriveBC has no cameras on the Gulf Islands or on most side roads. Mainland ferry-terminal cameras are left out.
- No road conditions, closures or incidents: use DriveBC for those. No Town Report row or Town Finder criterion.
- No explainer-film spec: the layer gets the generic per-layer film, which records whatever the camera showed that day.

## Source
`scripts/cameras.mjs` (`buildCameras`), `src/cameras.ts` (`camerasLayer`, `viewer`); data `public/data/cameras.json`
from the `cameras` stage.
