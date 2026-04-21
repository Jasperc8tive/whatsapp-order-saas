# Epic 2 — SLA & Dispatch Intelligence Acceptance Checklist

## SLA Timers & Badges
- [ ] Every active order card displays an SLA badge with age and color (green/amber/red)
- [ ] SLA badge shows breach warning (icon + pulse) when breached

## Priority Scoring
- [ ] Each order has a computed priority score (age + tier + amount + ETA risk)

## Queue/Sort Presets
- [ ] Operator can switch queue strategy in one click
- [ ] Presets: Urgent first (priority), Oldest unassigned, High value
- [ ] Board re-sorts instantly on preset change

## Coverage & Warnings
- [ ] 100% of active orders show SLA badge
- [ ] Breach warning appears before SLA threshold

## Manual Test Steps
1. Load the order board with several orders in different states and ages
2. Confirm SLA badge and color for each card
3. Simulate/adjust order age to trigger amber and red states
4. Switch queue preset and verify order sorting
5. Confirm breach warning icon appears when SLA is breached
6. Confirm badge is never missing on any active order

---

> Use this checklist to verify Epic 2 acceptance criteria in staging or local dev.
