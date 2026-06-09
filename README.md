    # VIA — Ancient World Explorer

> *"The world's oldest unsolved mysteries. Go find them."*

A map-based application that layers the ancient Roman world onto the present. Explore roads, cities, ports, and fortresses across the full Roman Empire — and discover historical quests waiting to be completed by travelers today.

## What It Does

- **ANCIENT / MODERN toggle** — switch between a Roman-era map and modern satellite/street view, with all sites staying pinned in place
- **Quest markers** — sites with missing photographs or unverified coordinates in the [Pleiades](https://pleiades.stoa.org) scholarly gazetteer are flagged as open quests
- **ORBIS travel cards** — each site shows how many days it took to travel to Rome in the 2nd century AD (powered by the [Stanford ORBIS model](https://orbis.stanford.edu))
- **Roman road network** — 14 major roads plotted across the empire
- **95+ sites** — from Britain to Mesopotamia, with rich historical descriptions
- **Mobile responsive** — bottom-sheet panel on phone, side panel on desktop

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [Pleiades](https://pleiades.stoa.org) | Authoritative ancient place IDs, coordinates, scholarly records |
| [Stanford ORBIS](https://orbis.stanford.edu) | Roman road network; travel time & cost model |
| [Digital Atlas of the Roman Empire](https://dare.ht.lu.se/) | Ancient map tiles |
| [Open Context](https://opencontext.org) | Archaeological excavation data |

## Quest Tiers

| Color | Type | Meaning |
|-------|------|---------|
| 🟡 Gold | Documented | Well-photographed, verified location |
| 🟠 Orange | Photo Quest | No portrait photo exists in Pleiades |
| 🔴 Red | Location Quest | Coordinates unverified in Pleiades |

## Running Locally

No build step required. Clone the repo and open `index.html` in a browser:

```bash
git clone https://github.com/danielkorr/ancient-world-explorer.git
cd ancient-world-explorer
open index.html   # or just double-click the file
```

## Live Demo

Deployed via GitHub Pages: **https://danielkorr.github.io/ancient-world-explorer**

## Roadmap

- **Stage 2** — Backend API, ORBIS route calculations, user accounts, GPS near-me
- **Stage 3** — PWA / offline mode, push notifications, expedition planning
- **Stage 4** — Community contributions, verified discovery pipeline back to Pleiades

## Contributing

This project is in active early development. If you're a classicist, archaeologist, or digital humanist interested in the scholarly layer, please get in touch.

## License

MIT — open source and free to build on.

---

*Built with [Leaflet.js](https://leafletjs.com), [Pleiades](https://pleiades.stoa.org), [Stanford ORBIS](https://orbis.stanford.edu), and [DARE tiles](https://dare.ht.lu.se/).*
