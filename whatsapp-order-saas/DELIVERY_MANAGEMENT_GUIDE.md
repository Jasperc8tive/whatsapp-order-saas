# Delivery Management System - Integration Guide

## Overview
This guide documents the delivery management system components added to WhatsOrder, including order assignment queue management and activity logging.

## New Components

### 1. **OrderAssignmentBoard** (`components/OrderAssignmentBoard.tsx`)
A drag-and-drop Kanban-style board for assigning orders to delivery managers.

**Features:**
- Unassigned orders in left column
- Delivery manager queues in right column
- Drag orders to assign them automatically
- Click × to unassign orders
- Real-time status indicators
- Color-coded order statuses (pending, confirmed, processing, etc.)

**Props:**
```typescript
{
  orders: Order[];
  deliveryManagers: DeliveryManager[];
  currentUserId: string;
}
```

**Data Flow:**
1. User drags unassigned order to a delivery manager
2. Component calls `/api/orders/[id]/assign` API
3. API validates permissions and creates `order_assignments` record
4. Activity is logged to `activity_logs` table
5. UI updates with new assignment state

---

### 2. **ActivityTimeline** (`components/ActivityTimeline.tsx`)
Real-time activity log showing all operations and changes in the workspace.

**Features:**
- Chronological timeline of activities
- Filter by entity type (order, assignment, customer, user)
- Filter by action (created, updated, assigned, delivered, etc.)
- Date range filtering (today, week, month, all)
- Auto-refresh every 30 seconds (configurable)
- User attribution with names
- Metadata display for detailed info
- Visual timeline with icons and status badges

**Props:**
```typescript
{
  vendorId: string;
  filters?: {
    entityType?: string;
    action?: string;
    dateRange?: 'today' | 'week' | 'month' | 'all';
  };
  autoRefresh?: boolean;
}
```

---

## New API Routes

### 1. **POST /api/orders/[id]/assign**
**Purpose:** Assign or unassign an order to/from a delivery manager

**Request Body:**
```json
{
  "assignedToUserId": "uuid",  // Empty string to unassign
  "reason": "Optional reason for assignment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order assigned/unassigned"
}
```

**Permissions:**
- Workspace owner or staff member required
- Target user must be workspace member

**Side Effects:**
- Creates/updates record in `order_assignments` table
- Inserts activity log in `activity_logs` table

---

### 2. **GET /api/activity**
**Purpose:** Fetch filtered activity logs for a workspace

**Query Parameters:**
- `vendorId` (required): Workspace ID
- `entityType` (optional): 'order', 'assignment', 'customer', 'user'
- `action` (optional): 'created', 'updated', 'assigned', 'delivered', etc.
- `dateRange` (optional): 'today', 'week', 'month', 'all' (default: 'all')

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "actor_id": "uuid",
      "actor_name": "John Doe",
      "entity_type": "assignment",
      "entity_id": "uuid",
      "action": "assigned",
      "metadata": {},
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 10
}
```

---

## New Dashboard Pages

### 1. **Delivery Queue** (`app/dashboard/delivery/page.tsx`)
Full-page delivery queue management interface.

**Accessible at:** `/dashboard/delivery`

**Features:**
- Server-side rendering for initial data load
- Shows all pending/processing orders
- Lists all delivery managers/staff members
- OrderAssignmentBoard integrated
- Real-time updates via client-side polling

---

### 2. **Activity Log** (`app/dashboard/activity/page.tsx`)
Full-page activity timeline viewer.

**Accessible at:** `/dashboard/activity`

**Features:**
- Server-side rendering for SEO
- ActivityTimeline component integrated
- Auto-refresh enabled by default
- Responsive design

---

## Database Tables Used

### `order_assignments`
```sql
id          uuid primary key
order_id    uuid (unique, references orders)
assigned_to uuid (references auth.users)
assigned_by uuid (references auth.users)
reason      text
created_at  timestamptz
```

### `activity_logs`
```sql
id            uuid primary key
workspace_id  uuid (references users)
actor_id      uuid (references auth.users)
entity_type   text
entity_id     uuid
action        text
meta          jsonb
created_at    timestamptz
```

### `workspace_members`
```sql
id           uuid primary key
workspace_id uuid (references users)
user_id      uuid (references auth.users)
role         workspace_role enum ('owner', 'staff', 'delivery_manager')
display_name text
is_active    boolean
created_at   timestamptz
```

---

## Navigation Integration

The sidebar has been updated with two new menu items:

1. **Delivery Queue** → `/dashboard/delivery`
   - Icon: Package/Queue symbol
   - Position: Before "Queue" (job health)

2. **Activity** → `/dashboard/activity`
   - Icon: Clock/Timeline symbol
   - Position: Before "Queue" (job health)

---

## User Permissions

| Role | Can Assign | Can View Activity | Notes |
|------|-----------|------------------|-------|
| Owner | Yes | Yes | Full workspace access |
| Staff | Yes | Yes | Can manage orders/assignments |
| Delivery Manager | No | Yes | Can view but not assign |
| Regular User | No | No | No access |

---

## Usage Examples

### Assigning an Order
```typescript
// User drags order to delivery manager
// Component automatically calls:
POST /api/orders/{orderId}/assign
{
  "assignedToUserId": "{managerId}",
  "reason": "Assigned via queue board"
}
```

### Viewing Activity
```typescript
// Navigate to /dashboard/activity
// Or embed in another page:
<ActivityTimeline 
  vendorId={vendor.id}
  autoRefresh={true}
/>
```

### Unassigning an Order
```typescript
// User clicks × button or API call:
POST /api/orders/{orderId}/assign
{
  "assignedToUserId": ""  // Empty string = unassign
}
```

---

## Future Enhancements

1. **Real-time Updates** - Implement WebSocket for live updates without polling
2. **Assignment History** - Show full history of assignments for an order
3. **Performance Metrics** - Delivery manager completion rates and statistics
4. **Bulk Operations** - Assign multiple orders at once
5. **Auto-Assignment** - Smart algorithm to distribute orders evenly
6. **Notifications** - NotifyAssigned delivery managers via WhatsApp/SMS
7. **Analytics Dashboard** - Delivery performance analytics and insights
8. **Assignment Rules** - Define rules for automatic assignment based on criteria

---

## Troubleshooting

### Orders Not Loading
- Check user has permission to view vendor
- Verify `orders` table has data with `order_status` in ['pending', 'confirmed', 'processing']
- Check Supabase RLS policies aren't blocking reads

### Delivery Managers Not Showing
- Ensure team members are added to workspace
- Check `workspace_members` table has records with `is_active = true`
- Verify role is 'staff' or 'delivery_manager'

### Assignment Not Working
- Check network tab for API errors
- Verify user is workspace owner or staff
- Check target user is active member of workspace
- Review Supabase logs for INSERT errors on `order_assignments`

### Activity Log Not Updating
- Check `activity_logs` table has records
- Verify `workspace_id` matches vendor ID
- Check API filters are set correctly
- Ensure `/api/activity` endpoint is responding

---

## Type Definitions

### Order (from component)
```typescript
interface Order {
  id: string;
  order_status: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  created_at: string;
  assignment?: {
    assigned_to: string;
    assigned_by: string;
    assigned_to_name?: string;
  };
}
```

### DeliveryManager (from component)
```typescript
interface DeliveryManager {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: "staff" | "delivery_manager";
}
```

### Activity (from API)
```typescript
interface Activity {
  id: string;
  workspace_id: string;
  actor_id?: string;
  actor_name?: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  meta: Record<string, any>;
  created_at: string;
}
```

---

## Performance Notes

- **Activity Timeline**: Limited to 100 records per query (configurable)
- **Delivery Queue**: Fetches all unassigned + in-progress orders
- **Assignment API**: Single upsert operation (efficient)
- **Activity Logging**: Non-blocking (errors don't affect main operation)

---

## Security Considerations

1. **Row-Level Security**: All tables protected by RLS policies
2. **Permission Checks**: Each API validates user role and workspace membership
3. **Immutable Activity Log**: Activity logs are append-only, cannot be deleted
4. **User Attribution**: All activities tracked with actor_id for accountability
5. **Scope Isolation**: Users can only see data from their workspace

---

## Testing Checklist

- [ ] Create test vendor with multiple team members
- [ ] Create test orders in 'pending' status
- [ ] Add staff member as delivery manager
- [ ] Test drag-drop assignment from queue board
- [ ] Verify activity log shows assignment action
- [ ] Test unassign via × button
- [ ] Filter activity by entity type
- [ ] Filter activity by date range
- [ ] Verify permissions (non-staff can't assign)
- [ ] Test with multiple vendors (scope isolation)

---

## Performance Test Results

(To be filled in with actual performance metrics)

- Assignment operation latency: ___ ms
- Activity log fetch: ___ ms
- Page load time (delivery queue): ___ ms
- Activity timeline render: ___ ms
