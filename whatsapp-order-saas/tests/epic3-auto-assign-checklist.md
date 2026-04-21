# Epic 3 — Auto-assignment v1 Acceptance Checklist

## Rules Engine
- [ ] Auto-assignment uses manager load, role, shift, and zone (where available)
- [ ] >90% of eligible orders are assigned automatically

## Bulk Assignment
- [ ] "Assign all unassigned" button assigns all eligible orders in one click
- [ ] Preview modal shows assignments before confirming
- [ ] Rebalance action handles 50+ unassigned orders in <5s

## Manual Override
- [ ] Dispatcher must provide a reason when overriding auto-assignment
- [ ] Reason is logged and visible in assignment history

## Logging
- [ ] Every assignment logs actor, timestamp, and source (manual/auto)

## Manual Test Steps
1. Load board with 50+ unassigned orders and several managers
2. Use bulk assign and confirm all assignments complete in <5s
3. Override an auto-assigned order and verify reason is required and logged
4. Check assignment logs for actor, timestamp, and source
5. Confirm >90% of eligible orders are assigned automatically

---

> Use this checklist to verify Epic 3 acceptance criteria in staging or local dev.
