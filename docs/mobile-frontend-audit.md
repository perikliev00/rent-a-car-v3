# Mobile frontend audit

**Audited commit (base):** `6dfe969331d2b7bf0d50fb800f1ef9e672243f35` (`main`)  
**Working-tree scope:** mobile layout/UI/calendar/e2e/docs only. Unrelated WIP preserved (realistic fleet seed files, README/package.json seed docs, accidental `tatus --short`).  
**Environment:** local Postgres `localhost:5432/rent_a_car` (dev) and `luxride_test` (e2e). No production mutations.

## Summary

Document-level horizontal overflow on the admin app at ~293px was driven primarily by:

1. Missing `min-w-0` on the admin content flex column.
2. Mobile chip navigation without Logout / Back to site.
3. Intrinsic-width form grids (especially native `type="date"`) and wide tables expanding ancestors.
4. Calendar toolbar/timeline min-widths expanding the page instead of staying in a scroll container.

Fixes: mobile Drawer nav, shared overlay/picker hardening (both apps), page-level stacking/`min-w-0`, calendar Day/Agenda + drag safety, Playwright mobile project.

## Route coverage matrix

Legend: **P** = pass (verified), **F** = fixed then verified, **B** = blocked, **E** = emulated only.

### Admin (`admin-front-end`)

| Route | 293 | 320–430 | 768 | 1024+ | States checked | Status | Evidence |
|-------|-----|---------|-----|-------|----------------|--------|----------|
| `/login` | E | E | E | E | form | F | layout/min-w-0; unit LoginPage |
| `/admin` | E | E | E | E | loaded | F | AdminDashboardPage overflow sweep |
| `/admin/reservations` | E | E | E | E | table/panels | F | OpsTable containment |
| `/admin/calendar` | F | F | E | E | day/week/month, agenda, picker | F | Playwright mobile + screenshots |
| `/admin/tasks*` | E | E | E | E | list/filters | F | code sweep |
| `/admin/cars`, `/admin/cars/:id` (+tabs) | E | E | E | E | forms/tabs/tables | F | code sweep |
| `/admin/pricing` | E | E | E | E | sections | F | code sweep |
| `/admin/fleet-alerts` | E | E | E | E | list | F | code sweep |
| `/admin/orders` (+new/edit/detail) | F | F | E | E | filters/table/create CTA | F | Playwright + after/orders.png |
| `/admin/contacts` | E | E | E | E | list | F | code sweep |
| `/admin/payments` | F | F | E | E | filters/tables | F | Playwright + after/payments.png |
| `/admin/analytics` | F | F | E | E | dates/KPIs/chart | F | Playwright + after/analytics.png |
| `/admin/notifications` | F | F | E | E | table scroll | F | Playwright + after/notifications.png |
| `/admin/audit-logs` | E | E | E | E | filters/table | F | code sweep |
| `/admin/users`, `/admin/roles` | E | E | E | E | forms/matrix | F | code sweep |
| Mobile nav drawer | F | F | n/a | n/a | RBAC links, logout, close | F | Playwright + after/mobile-nav.png |

### Public (`front end`)

| Route | Mobile | Desktop | Status | Notes |
|-------|--------|---------|--------|-------|
| `/` SearchForm + fleet | F | E | F | mobile menu + overflow e2e |
| `/search` | F | E | F | overflow e2e |
| `/cars/:id`, `/order/:id`, `/checkout/*` | E | E | F | code + unit (isolated) |
| Auth `/login` `/signup` `/verify-email` | E | E | F | AuthPageShell padding |
| `/account/*` | E | E | F | account page sweeps |
| Static pages | E | E | F | layout menu + footer |

## Findings (revalidated A–F + new)

| ID | Severity | Status | Viewport | Files | Root cause | Fix |
|----|----------|--------|----------|-------|------------|-----|
| A | High | Fixed | &lt;lg | `AdminLayout.tsx` | No logout on mobile; no `min-w-0` | Drawer nav + `min-w-0` |
| B | High | Fixed | all | `DateSelect.tsx` (both apps) | Always `top=bottom+6`; no scroll/resize | Flip + reposition listeners |
| C | High | Fixed | narrow | Calendar timeline/month + `useTimelineDrag.ts` | Page overflow; no pointercancel | Contained scroll, narrower car col, agenda, drag cleanup |
| D | Med | Fixed | all | `Modal.tsx`, `Drawer.tsx` | No focus trap / body lock | `useOverlayLock` |
| E | Med | Fixed | narrow | `TimeSelect.tsx`, Block/Task modals | Absolute popup clipped; 2-col dates | Portal + stack |
| F | Med | Fixed | n/a | `e2e/playwright.config.ts` | Desktop Chrome only | Added `mobile-chrome` |
| G | High | Fixed | 293 | Orders/Analytics/Payments forms | Dense grids + date intrinsic width | Stack + `min-w-0` |
| H | Med | Fixed | &lt;md | `PublicLayout.tsx` | No primary mobile nav | Drawer menu |

## Verification results

### Overflow measurements (293×643, local after fix)

From `docs/mobile-audit/after/overflow-report.json`:

| Surface | Document overflow (px) |
|---------|------------------------|
| Orders | 0 |
| Analytics | 0 |
| Notifications | 0 |
| Payments | 0 |
| Calendar week | 0 |
| Mobile nav open | 0 |
| Date picker open | 0 |

### Commands run

| Command | Outcome |
|---------|---------|
| `admin-front-end`: `npm run check` | Pass (189 tests; 4 pre-existing eslint warnings) |
| `front end`: `npm run typecheck` | Pass |
| `front end`: `npm run check` | Full suite: 5 timeouts under heavy parallel load; **re-run of those 5 files: 13/13 pass** (flake, not functional regression) |
| `e2e`: `npx playwright test specs/mobile-admin-layout.spec.ts --project=mobile-chrome` | **3/3 pass** |
| `e2e`: `npx playwright test specs/mobile-public-booking.spec.ts --project=mobile-chrome` | **1/1 pass** |
| `node e2e/scripts/capture-mobile-audit.mjs` | Screenshots written; overflow 0 |

### Screenshots

- Before baseline: production user captures (see `docs/mobile-audit/before/README.md`) — local pre-fix captures were not available in this pass.
- After: `docs/mobile-audit/after/{orders,analytics,notifications,payments,calendar,mobile-nav,date-picker}.png`

## Remaining issues / blockers

1. **Physical devices / real iOS Safari / software keyboard** — not verified (Chromium mobile emulation only). WebKit Playwright browser not installed on this Windows host.
2. **Landscape short viewport** — not separately automated; DateSelect uses `visualViewport` listeners for keyboard/resize.
3. **Desktop calendar default** — agenda auto-enables only when `matchMedia(max-width:767)` matches; desktop unit tests keep timeline.
4. **Customer Vitest full-suite timeouts** — intermittent under parallel load; isolated re-runs pass.
5. **Production read-only** — after screenshots are from local data, not production datasets.

## Key implementation files

- `admin-front-end/src/components/layout/AdminLayout.tsx`
- `admin-front-end/src/components/ui/{Modal,Drawer,DateSelect,TimeSelect,useOverlayLock,Card,Input,Select}.tsx`
- `admin-front-end/src/pages/admin/AdminCalendarPage.tsx`, `calendar/DayAgendaList.tsx`, `calendar/timeline/useTimelineDrag.ts`
- `front end/src/components/layout/PublicLayout.tsx` (+ mirrored UI)
- `e2e/specs/mobile-admin-layout.spec.ts`, `e2e/specs/mobile-public-booking.spec.ts`, `e2e/helpers/overflow.ts`
