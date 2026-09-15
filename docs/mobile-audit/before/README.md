Before screenshots were not captured from local pre-fix builds in this pass.
Production evidence at 293x643 CSS px (user Chrome responsive mode) is the baseline:
- https://admin.rent-a-car-brns.org/admin/orders
- /admin/analytics
- /admin/notifications
- /admin/payments
- /admin/calendar?view=week&date=2026-09-15
Symptoms: document-level horizontal displacement, clipped nav/filters/KPI cards/tables/calendar toolbar.
After screenshots live in docs/mobile-audit/after/ with measured overflow=0 (see overflow-report.json).
