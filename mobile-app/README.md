# WhatsOrder Mobile App

Production-ready Expo React Native companion app for WhatsOrder.

## Stack

- Expo + React Native + TypeScript
- React Navigation (Bottom Tabs + Native Stack)
- Zustand state management
- Supabase JS client (Auth, Postgres, Realtime)
- Expo Push Notifications
- React Native Gesture Handler + Reanimated
- Sentry

## Environment Variables

Create a `.env` file from `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` (defaults to `https://whatsorder.app`)
- `EXPO_PUBLIC_SENTRY_DSN` (optional)

## Run

```bash
npm install
npx expo start --clear
```

If your shell starts at workspace root, run:

```bash
npx --prefix ./mobile-app expo start --clear
```

## Implemented Modules

- Authentication: login/signup + onboarding profile save
- Home dashboard metrics
- Orders Kanban with gesture-based horizontal status movement
- Order details actions (assign delivery + WhatsApp deep link)
- Customers list/search + profile/history
- Products CRUD
- Delivery queue and status progression
- Settings with store link copy/share
- Team member listing and invite flow
- Billing plans + Paystack upgrade bootstrap
- AI order drafts review flow
- Voice capture to AI draft parsing
- Campaign history reporting
- Analytics CSV export
- Inventory tracking with low-stock alerts
- Loyalty dashboard (auto points model)
- Customer-level loyalty ledger (bonus/redeem actions + history)
- Workspace-configurable loyalty rules (points/order and reward threshold)
- Marketplace vendor discovery
- Order-level Paystack payment link generation
- Supabase realtime subscriptions for orders and deliveries
- Expo push notification registration flow
- Offline fallback cache for orders and customers

## API Integration

- `/api/orders`
- `/api/whatsapp`
- `/api/paystack`
- `/api/notify`
- `/api/team`

Supabase session access token is automatically attached for backend API calls.
