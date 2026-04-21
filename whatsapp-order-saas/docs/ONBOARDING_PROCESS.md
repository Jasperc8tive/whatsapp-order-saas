# WhatsOrder Onboarding Process

This onboarding process is designed for first-time workspace owners and operators.
It explains each major section in the app, what it does, and how to use it.

## Onboarding Goals

By the end of onboarding, you should be able to:
- Configure your workspace profile and storefront link
- Add products with correct pricing
- Receive and manage customer orders
- Assign team members and delivery tasks
- Review AI-captured order drafts
- Track activity and job queue health
- Understand billing and usage limits

## Suggested Onboarding Timeline

## Day 1: Core Setup
1. Complete Settings
2. Add Products
3. Test Storefront
4. Place Test Order

## Day 2: Team and Operations
1. Invite Team Members
2. Assign Orders in Delivery Queue
3. Review Activity Timeline
4. Check Queue Health

## Day 3: Optimization
1. Validate AI Draft Review Flow
2. Confirm Billing Plan Fits Monthly Volume
3. Document Internal SOPs for team handoffs

## App Sections and Features

## 1. Overview
Path: /dashboard

Purpose:
- Provides a quick snapshot of business performance.

Key features:
- KPI cards for orders and revenue
- Recent order feed
- Order status distribution summary

How to use:
- Review this page daily to understand top-level operational health.
- Use it as the starting point for day-to-day management.

## 2. Onboarding
Path: /dashboard/onboarding

Purpose:
- Guided checklist and section walkthrough for new users.

Key features:
- First-day setup steps
- Section-by-section descriptions
- Launch checklist

How to use:
- Follow in order when setting up a new workspace.
- Revisit when training new staff.

## 3. Orders
Path: /dashboard/orders

Purpose:
- Manage customer orders across statuses from intake to completion.

Key features:
- Kanban-style board for order status progression
- Order details and status updates
- Assignment support for delivery workflow

How to use:
- Move orders through statuses as work is completed.
- Keep statuses updated in real time to ensure team clarity.

## 4. Products
Path: /dashboard/products

Purpose:
- Maintain your product catalog and pricing.

Key features:
- Add, edit, and disable products
- Price management
- Active product listing control

How to use:
- Keep product names clear and consistent for AI mapping.
- Update prices before promotions or major menu changes.

## 5. Customers
Path: /dashboard/customers

Purpose:
- Organize customer records and repeat-customer context.

Key features:
- Customer list and contact details
- Repeat customer visibility
- Customer-order relationship context

How to use:
- Verify customer phone and name details regularly.
- Use history context when resolving support requests.

## 6. Team
Path: /dashboard/team

Purpose:
- Manage collaborators and role-based access.

Key features:
- Invite staff and delivery managers
- Role assignment and access boundaries
- Invitation and member tracking

How to use:
- Assign least-privilege roles.
- Review active members periodically for security.

## 7. AI Drafts
Path: /dashboard/drafts

Purpose:
- Review and decide on AI-captured orders from inbound messages.

Key features:
- Pending review queue
- Approve draft to convert into order
- Reject draft to prevent incorrect conversion

How to use:
- Prioritize high-confidence drafts first.
- Confirm item names, quantities, and customer details before approval.

## 8. Delivery Queue
Path: /dashboard/delivery

Purpose:
- Assign and rebalance order dispatch workload.

Key features:
- Drag-and-drop assignment board
- Unassigned and assigned order columns
- Unassign and reassignment controls

How to use:
- Assign all pending delivery-ready orders.
- Rebalance workload during peak periods.

## 9. Activity
Path: /dashboard/activity

Purpose:
- Audit timeline for operational actions.

Key features:
- Real-time event timeline
- Filters by entity type, action, and date range
- Visibility into assignment and workflow events

How to use:
- Use for incident reviews and accountability.
- Check actions before escalating support issues.

## 10. Queue
Path: /dashboard/queue

Purpose:
- Monitor background jobs and reliability.

Key features:
- Job states: queued, running, failed, dead, done
- Search and filter controls
- Queue health monitoring

How to use:
- Check this page when automations or webhooks feel delayed.
- Investigate failed and dead jobs first.

## 11. Billing
Path: /dashboard/billing

Purpose:
- Track plan limits and manage upgrades.

Key features:
- Usage meter for monthly limits
- Plan comparison and upgrade flow
- Upgrade status and error visibility

How to use:
- Review usage weekly.
- Upgrade before hitting operational volume limits.

## 12. Settings
Path: /dashboard/settings

Purpose:
- Configure workspace identity and ordering endpoints.

Key features:
- Business profile settings
- Storefront slug and shareable public link
- WhatsApp number setup

How to use:
- Set this up before sharing your storefront publicly.
- Verify numbers and links after any branding change.

## 13. Public Storefront
Path: /order/{vendor_slug}

Purpose:
- Customer-facing order intake page.

Key features:
- Product selection and quantity capture
- Customer detail collection
- Payment callback and result flow

How to use:
- Place a test order after product setup.
- Confirm payment and callback behavior before launch.

## 14. Payment Callback
Path: /pay/callback

Purpose:
- Displays payment outcomes to customers after checkout.

Key features:
- Success, pending, failed, and abandoned states
- Customer guidance for next action

How to use:
- Validate callback behavior during sandbox testing.
- Ensure support team knows how to handle failed payments.

## 15. Auth Pages
Paths:
- /login
- /signup

Purpose:
- Workspace access and identity entry.

Key features:
- Secure login/signup flow
- Access control to dashboard routes

How to use:
- Restrict account sharing.
- Use role-based access via team invitations instead.

## First Launch Checklist

- Business profile is complete
- WhatsApp number is configured and verified
- At least 5 products are added with accurate prices
- Storefront slug and public link are tested
- One successful test order is created and processed
- Team members invited with correct roles
- Delivery assignment flow tested
- AI draft approval flow tested
- Billing usage and plan reviewed
- Queue health checked with no critical failed jobs

## Team Training Checklist

- Owner can configure settings and billing
- Staff can manage products and orders
- Delivery manager can handle delivery assignments and status updates
- Team understands activity timeline filters
- Team knows escalation flow for failed jobs and payment issues

## Suggested Operating Cadence

Daily:
- Review Overview
- Process Orders
- Review AI Drafts
- Check Delivery Queue

Weekly:
- Review Customers and repeat orders
- Audit Activity logs
- Check Queue failures and dead jobs
- Review Billing usage

Monthly:
- Confirm plan fit and upgrade if needed
- Revalidate product catalog quality
- Review role assignments and inactive team members

## Support and Troubleshooting Entry Points

If orders are missing:
- Check AI Drafts, Orders, and Queue pages

If assignments are not visible:
- Check Team roles and Delivery Queue

If payment issues occur:
- Check Billing and Payment callback behavior

If automations look delayed:
- Check Queue status and failed jobs

## Completion Criteria

Onboarding is complete when:
- You can receive, process, assign, and complete a real order
- Your team can work independently in role-specific areas
- Queue and activity visibility are part of daily operations
- Billing and limits are understood and monitored
