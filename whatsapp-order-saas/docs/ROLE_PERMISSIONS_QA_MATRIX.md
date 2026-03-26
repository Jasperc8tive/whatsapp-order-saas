# Role Permissions QA Matrix

This matrix validates workspace role behavior for Sprint 2 RBAC hardening.

## Roles
- owner: full access
- staff: operational write access
- delivery_manager: delivery and assignment-limited access
- outsider: authenticated user not in workspace

## Core Feature Matrix

| Feature / Action | owner | staff | delivery_manager | outsider |
| --- | --- | --- | --- | --- |
| View orders in workspace | Allow | Allow | Allow | Deny |
| Create manual order | Allow | Allow | Deny | Deny |
| Update order status | Allow | Allow | Allow | Deny |
| Assign order to owner/staff | Allow | Allow | Deny | Deny |
| Assign order to delivery_manager | Allow | Allow | Allow | Deny |
| Assign order to self | Allow | Allow | Allow | Deny |
| Unassign order assigned to self | Allow | Allow | Allow | Deny |
| Unassign order assigned to someone else | Allow | Allow | Deny | Deny |
| Manage product aliases | Allow | Allow | Deny | Deny |
| Manage products (create/update/delete) | Allow | Allow | Deny | Deny |
| Invite/revoke team members | Allow | Deny | Deny | Deny |
| Change team member role | Allow | Deny | Deny | Deny |
| Read activity logs | Allow | Allow | Allow | Deny |

## QA Scenarios

1. Owner can assign any order to any active workspace member.
2. Staff can assign any order to any active workspace member.
3. Delivery manager can assign only to self or another delivery manager.
4. Delivery manager cannot assign order to owner or staff.
5. Delivery manager can unassign only when current assignee is self.
6. Outsider cannot read or mutate order assignments for another workspace.
7. All roles except outsider can read assignment badge data for orders in their workspace.
8. Only owner can invite, revoke, remove, or change team roles.

## Suggested Manual Test Flow

1. Create four users: owner, staff, delivery_manager, outsider.
2. Add staff and delivery_manager to owner workspace.
3. Open order board as each user and attempt all assignment actions.
4. Verify errors match matrix for denied paths.
5. Confirm activity log entries appear for allowed assignment changes.
6. Confirm no cross-workspace data leak for outsider.

## API-Level Assertions

- assignOrder returns error when assignee is not an active workspace member.
- getOrderAssignment returns error for users outside the order workspace.
- listAssignableMembers returns:
  - full list for owner/staff
  - self + delivery_manager subset for delivery_manager
- unassignOrder blocks delivery_manager when assignment belongs to another user.
