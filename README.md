# ISACS — Operator Console

A role-aware web console for **ISACS** (Integrated Security Access Control System): a
real-time Command Center plus nine functional modules (ASRS incidents, surveillance,
access control, assets, visitors, appointments, staff, users/roles, system rules).

Recreated in Next.js from the design handoff in
`../design_handoff_isacs_console/` (see its `README.md` for the full spec). This build
covers the **Super Administrator** experience.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Zustand** for the cross-module client store
- **lucide-react** icons, **IBM Plex Sans/Mono** via `next/font`
- Plain CSS + CSS custom properties for the token-driven, themeable design

## Getting started

```bash
npm run dev     # dev server at http://localhost:3000
npm run build   # production build (also type-checks + lints)
npm start       # serve the production build
```

## Project layout

```
src/
  app/
    layout.tsx          Root layout: fonts, no-flash theme script, providers, shell
    page.tsx            Command Center (dashboard)
    incidents/ …        One route per module view (ASRS, surveillance, access, …)
    globals.css         Design tokens, 3 themes, density, keyframes, primitives
  components/
    ClientRoot.tsx      Client bootstrap: hydrate store, apply/persist theme, timers
    AppShell.tsx        Sidebar + Topbar + ready-gated <main>
    Sidebar / Topbar    Persistent chrome (nav, clock, theme switcher, alert bell)
    FacilityMap.tsx     Schematic floor-plan placeholder (replace with a real map layer)
    ui.tsx, nav.ts      Shared pills/headers + nav config
  lib/
    types.ts            Domain types (mirror the REST resources)
    seed.ts             In-memory seed data (ported from the prototype)
    store.ts            Zustand store + all cross-module actions
    format.ts           Tone maps, relative time, role/permission tables
```

## Design system

Three built-in themes (**Obsidian** default, **Daylight**, **Steel**) switch from the
topbar; the accent is independently overridable and density (compact/balanced/spacious)
scales padding. All are CSS variables on `<html>` (`data-theme`, `data-density`,
`--accent`), persisted to `localStorage` and applied pre-paint by an inline script to
avoid a flash. Tokens, type scale, and spacing follow the handoff exactly.

## Cross-module behavior (the live demo)

State lives in one Zustand store, so a single action propagates everywhere the brief
requires — without a page reload (sidebar/topbar persist across `<Link>` navigations):

- **3-strike access failure** at a checkpoint → auto-creates a critical ASRS incident,
  emits ACCESS + ASRS events to the bus, and bumps the sidebar badge + topbar alert bell.
- **Camera escalation** → incident with the last snapshot attached.
- **Asset protocol breach** → high-severity incident. Interlock: a protocol can't be
  activated without an assigned GPS tracker.
- **Incident lifecycle** Open → Investigating → Resolved is enforced; resolved records
  are immutable.
- **Appointment scheduling** validates duration vs. the facility max and refuses host
  double-booking.
- The **live event bus** auto-appends a plausible event every ~3.8s (toggleable).

## Wiring to the real API (next phase)

Data is currently seeded in-memory inside `lib/store.ts` to make the prototype live.
Each module's reads/writes are the seam for the documented ISACS REST API
(`../design_handoff_isacs_console/reference/ISACS_API_Reference.pdf`): replace the
seed reads with `GET` calls and the mutating actions (`runCheck`, `escalateCam`,
`reportBreach`, `assignIncident`, `resolveIncident`, `checkIn`, `submitSchedule`, …)
with their corresponding endpoints, and drive the live feed from the RabbitMQ-backed
event stream (websocket/SSE) instead of the local timer.

## Known gaps (from the handoff, intentionally not yet built)

Auth/login screen + session expiry, role-scoped incident visibility for Security
Personnel, appointment cancel/postpone UI, visitor duplicate-email detection,
referential-integrity guards, bulk staff import, and purpose-categorized file uploads.
The facility map is a schematic placeholder to be replaced by a real lat/long-driven layer.
