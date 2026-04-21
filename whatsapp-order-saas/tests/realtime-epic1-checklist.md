# Epic 1: Real-time Operations Acceptance Test Checklist

## 1. Realtime Subscriptions
- [ ] Orders, assignments, and activity logs update in <2s for all operators.
- [ ] No polling requests are made when realtime is active.

## 2. Kanban Board
- [ ] Dragging a card to a new column updates for all users in <2s.
- [ ] No duplicate or missing cards after concurrent drag operations.
- [ ] Assignment changes (assign/unassign) are visible to all users in <2s.
- [ ] Optimistic UI: Card moves instantly, rolls back if server rejects.

## 3. Presence Indicators
- [ ] Delivery manager online/offline status updates in <2s.
- [ ] Presence bar shows all delivery managers, with correct status.

## 4. Activity Feed
- [ ] Activity log updates in real time (no polling).
- [ ] No duplicate or missing activity entries after concurrent actions.

## 5. General
- [ ] No polling intervals or redundant network requests in browser dev tools.
- [ ] No errors in browser console during realtime updates.
- [ ] All changes propagate to all open browser tabs/sessions.

---

## How to Test
1. Open two browser windows as different users (or incognito).
2. Perform order status changes, assignments, and unassignments.
3. Observe updates in both windows.
4. Check presence bar and activity feed for live updates.
5. Use browser dev tools to confirm no polling requests.

---

## Automated Test (Optional)
- [ ] Write Playwright or Cypress tests to simulate two users and verify UI updates.
- [ ] Add test for presence channel (mock two clients, check status propagation).
- [ ] Add test for assignment optimistic UI and rollback.
