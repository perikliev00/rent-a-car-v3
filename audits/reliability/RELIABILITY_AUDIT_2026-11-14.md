# Production Reliability Audit — 2026-11-14

Evidence-based, risk-driven, delta audit. Goal: confirm or reject practically significant defects; stop when the planned high-risk scope is exhausted.

## A. Проверен обхват

| Item | Value |
| --- | --- |
| Branch | `audit/regression-verify` |
| Commit (HEAD) | `dca51daf847585e33ab6f01f319fe1cf9be278dc` (PR #12 audit-five-findings) |
| Working tree | Dirty — large uncommitted reliability WIP + this audit's fixes |
| Prior audits | Security remediation `audits/security/SECURITY_REMEDIATION_REPORT.md` (SEC-001–013); five H-findings merged in HEAD; subsequent WIP for calendar/refund/checklist/fleet |

### Проверени подсистеми (delta)

- Payment / refund / checkout / bookingFinalization (WIP delta)
- Calendar move/resize + booking sync
- Admin order update / restore / conflict block resolution
- Return checklist + damage report migration 037
- RBAC owner assignment (`can_manage_users`)

### Основни инварианти

1. Calendar move/resize must not create booking blocks for statuses that do not own a live booking.
2. Soft-deleted orders must not mutate another order's booking block.
3. Order restore must not reactivate a terminal/refunded reservation link.
4. Return checklist must not mutate car/damage state outside allowed rental statuses.
5. Migration 037 must apply when pre-fix duplicate damage rows exist.
6. Non-owners must not be able to grant the owner role.
7. Paid cancel/refund, bookability guards, and foreign-block release (prior themes) remain intact.

### Изпълнени тестове

Against Postgres `127.0.0.1:62533` (`luxride_test`):

- `tests/integration/auditReliabilityDelta.test.js` — 6 passed (before-fix failures proved C1/C2/H1/H2/H3; after-fix all green including C3)
- Related regression: `calendarMovePhysicalRental`, `returnChecklistIdempotency`, `reservationChecklists`, `rbacOwnerInvariants`, `rbacOwnerConcurrency` — 27 passed total with evidence suite
- Unit: `tests/services/rbacService.test.js` — 10 passed

### Ограничения

- Full `npm run ci:local` / e2e not re-run in this pass.
- Frontend and deploy/ops paths were out of delta reliability scope (debt audit already covered FE unused code).
- Production DB content was not inspected; migration H1 is proven against a realistic duplicate-data fixture.

---

## B. Потвърдени дефекти

### REL-001 — P1 — Calendar move creates phantom booking for non-booked statuses

- **Компонент:** `calendarMoveService.js` → `bookingSync.updateRange`
- **Нарушение:** Move/resize allowed for `manual_review` (and other non-movable statuses); inserts a `booking` block without an order.
- **Сценарий:** Staff drags a `manual_review` calendar event to new dates → car appears booked → later confirm hits `OVERLAP` / stuck capacity.
- **Доказателство:** Integration test initially observed move succeeding with `blockCount > 0`. After fix: HTTP 409 `INVALID_STATUS_TRANSITION`, zero blocks.
- **Последствия:** False unavailability; blocked manual-review confirmation; possible stale cancelled API moves.
- **Статус:** **FIXED** — allow only `confirmed|car_prepared|picked_up|active_rental`.

### REL-002 — P1 — Soft-deleted order update can steal another booking block

- **Компонент:** `orderUpdateService.updateOrderCore` + `resolveStoredDateRange`
- **Нарушение:** No `isDeleted` guard; range resolution picks any overlapping booking block on the car.
- **Сценарий:** Order A cancelled (block removed) → Order B books same range → update on deleted A deletes B's block and writes a new one.
- **Доказателство:** Pre-fix `updateOrder` returned `success: true` on deleted A. After fix: `success: false`, B keeps one block.
- **Последствия:** Live confirmed booking without calendar protection → double booking risk.
- **Статус:** **FIXED** — reject soft-deleted updates with `ORDER_DELETED`.

### REL-003 — P2 — Restore reactivates order linked to `refunded` reservation

- **Компонент:** `orderRestoreService.js`
- **Нарушение:** Unlink only when reservation status is `cancelled`; `refunded`/`expired`/terminal stayed linked.
- **Сценарий:** Refund soft-deletes order → restore from bin → live order + block backed by terminal reservation; later delete fails transition.
- **Доказателство:** Post-fix test: restore creates a **new** `confirmed` reservation; old stays `refunded`; one booking block.
- **Последствия:** Inconsistent ledger/calendar; hard-to-clear blocks.
- **Статус:** **FIXED** — unlink cancelled/refunded/expired/completed/no_show.

### REL-004 — P1 — Migration 037 fails on pre-existing duplicate damage rows

- **Компонент:** `migrations/037_car_damage_report_source.sql`
- **Нарушение:** Backfill labels all matching unresolved duplicates as `return_checklist`, then unique index creation fails.
- **Сценарий:** Pre-upsert double-submit leftovers in production → migrate aborts → deploy blocked / runtime expects `source`.
- **Доказателство:** Fixture with two unresolved matching rows; prior SQL path aborted transaction. After dedupe step: exactly one unresolved `return_checklist` row; index applies.
- **Последствия:** Migration/deploy blocker for environments hit by the prior duplicate-create bug.
- **Статус:** **FIXED** — resolve duplicate rows (keep lowest id) before backfill/index.

### REL-005 — P1 — Manager can self-assign owner

- **Компонент:** `rbacService.assignUserRole` / `setUserRoles`; seed grants `can_manage_users` to `manager`
- **Нарушение:** Routes require only `can_manage_users`; no actor-must-be-owner check when granting owner.
- **Сценарий:** Default manager calls `PUT /users/:self/roles` with owner role id → becomes owner → can demote other owners when count > 1.
- **Доказателство:** Pre-fix HTTP 200 and `owner` in `user_roles`. After fix: HTTP 403; roles remain `manager` only.
- **Последствия:** Privilege escalation to full owner.
- **Статус:** **FIXED** — `assertActorCanAssignOwner` on owner grant paths. (Prior security audit gap; not covered by SEC-001–013.)

### REL-006 — P2 — Return checklist mutates car/damage without status gate

- **Компонент:** `checklistReturnService.submitReturnChecklist`
- **Нарушение:** Checklist upsert, damage upsert, and car mileage/fuel ran before status transition; non-returnable statuses still got HTTP 201.
- **Сценарий:** Submit return on `confirmed` reservation → 201, phantom damage, car mileage overwritten.
- **Доказателство:** Pre-fix HTTP 201 with mileage 99999 and damage row. After fix: HTTP 422, car unchanged, no damage.
- **Последствия:** Corrupt fleet state; false damage records.
- **Статус:** **FIXED** — require `picked_up|active_rental|returned` under row lock before mutations.

---

## C. Отхвърлени хипотези

| ID | Hypothesis | Result |
| --- | --- | --- |
| PAY-H1 | Unpaid cancelled hold becomes refundable via queue/`hasCapturedPayment` | REJECTED — PI/paid snapshot only on paid paths; lock-time assert |
| PAY-H2 | Cancel→refund releases foreign calendar block | REJECTED — no live order; foreignOwners guard |
| PAY-H3 | Double refund on cancelled path | REJECTED — locks + idempotency + pending-refund gate |
| PAY-H4 | New car-bookability guard drops paid money | REJECTED — routes to `manual_review` with PI snapshot |
| PAY-H5 | Paid `pending_payment` limbo via new guard | UNPROVEN — no reachable path found |
| CAL-stale-car-lock | Concurrent move unlocks previous car unsafely | REJECTED — target insert still locked; covered by concurrent move tests |
| CAL-force-overlap-500 | Force-move overlap returns 500 | REJECTED as reliability defect — rollback, no double book |
| DMG-retry | Return checklist still duplicates damages under concurrency | REJECTED — advisory lock + partial unique index |
| RBAC-last-owner | Last-owner removal / owner permission edit broken by WIP | REJECTED — existing invariants still hold |

---

## D. Оставащ риск

### Доказани нерешени

- None in this audit scope after the fixes above (working tree includes fixes; not yet committed).

### Непроверени области

- Full CI gate / e2e suite in this session
- Admin order **car change while `picked_up`/`active_rental`** (calendar blocks it; order update path not re-proven here)
- Whether `confirmManualReview` skipping hard bookability is intentional product policy
- Production DB duplicate-damage prevalence (migration now handles it)

### Приети ограничения

- Manager still has broad operational permissions by seed design; only **owner grant** is newly restricted.
- `returned` return-checklist resubmits remain allowed for idempotent ops edits.

### Хипотетични (без достатъчно доказателства)

- PAY-H5 pending_payment + paid session limbo
- Late ops resolve-then-resubmit creating a second auto damage after resolve

---

## E. Финално заключение

1. **Има ли нови доказани значими дефекти?** Да — **6** (REL-001…006), of which 4×P1 and 2×P2.
2. **Нужни ли са реално допълнителни промени?** След приложените поправки в работното дърво — **не** в проверените инварианти. Нужен е commit/PR когато е готово.
3. **Достатъчно надеждна ли е проверената функционалност?** Да, според failing-then-passing evidence на реална Postgres и свързаните regression suites.
4. **Изчерпани ли са смислените проверки в определения обхват?** Да — планираният висок риск (payments delta, calendar/orders, checklist/damage, RBAC owner) е покрит; по-нататъшното търсене би повторило вече отхвърлени хипотези.
5. **Има ли конкретно основание за нов одит?** Само при: (a) commit/deploy на този WIP, (b) нов код в payment/calendar/RBAC, или (c) доказателства за нерешения order-update physical-rental car-change път.

**STOP:** Delta audit complete. No further hypothesis expansion without new evidence.
