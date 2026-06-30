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
    layout.tsx          Root layout: fonts, no-flash theme script, ClientRoot
    globals.css         Design tokens, 3 themes, density, keyframes, primitives
    (console)/          Route group for the console (URL-invisible)
      layout.tsx        Wraps every module view in the AppShell chrome
      page.tsx          Command Center (dashboard)
      incidents/ …      One route per module view (ASRS, surveillance, access, …)
    login/page.tsx      Auth entry point (no shell, always-dark) — /login
    icon.png            NAF emblem favicon
  components/
    ClientRoot.tsx      Client bootstrap: hydrate store, apply/persist theme, timers
    AppShell.tsx        Sidebar + Topbar + ready-gated <main>
    Sidebar / Topbar    Persistent chrome (nav, clock, theme switcher, alert bell)
    FacilityMap.tsx     Schematic floor-plan placeholder (replace with a real map layer)
    ui.tsx, nav.ts      Shared pills/headers + nav config
    login/              AuthenticatorPhone + QrMatrix (login-only)
  lib/
    types.ts            Domain types (mirror the REST resources)
    seed.ts             In-memory seed data (ported from the prototype)
    store.ts            Zustand store + all cross-module actions
    format.ts           Tone maps, relative time, role/permission tables
    totp.ts             Demo TOTP helpers (login ↔ authenticator agree)
    config.ts           Data-source toggle + API base URL
```

## Login (`/login`)

Credential-first sign-in with mandatory 2FA, ported from the login handoff:
Credential (RFID / QR) → 6-digit OTP (TOTP primary, SMS fallback) → Success → console.
It lives outside the `(console)` route group so it renders without the sidebar/topbar,
and is scoped to the Obsidian dark theme regardless of the console's saved theme. The
on-screen authenticator phone is a demo aid (the live TOTP it shows is what the login
expects) — it's the separate mobile app in production and is trivially removable. The
demo TOTP/credential checks are stand-ins for `POST /auth/login` + `POST /auth/verify-otp`.
There is **no auth guard yet** — the console is reachable directly until the API is wired.

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

The login **screen + flow** is built (demo); real server-side auth, an auth guard on the
console, session/idle expiry, and instant logout-everywhere come with the API integration.
Still open: role-scoped incident visibility for Security Personnel, appointment
cancel/postpone UI, visitor duplicate-email detection, referential-integrity guards, bulk
staff import, and purpose-categorized file uploads. The facility map is a schematic
placeholder to be replaced by a real lat/long-driven layer.
