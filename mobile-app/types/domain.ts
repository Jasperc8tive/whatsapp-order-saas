export type PlanId = "starter" | "growth" | "pro";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";

export type DeliveryStatus =
  | "not_dispatched"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed";

export type WorkspaceRole = "owner" | "staff" | "delivery_manager";

export interface UserProfile {
  id: string;
  business_name: string;
  email: string;
  phone: string | null;
  plan: PlanId;
  whatsapp_number: string | null;
  slug: string | null;
  loyalty_points_per_order?: number;
  loyalty_reward_threshold?: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  total_orders?: number;
  total_spent?: number;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  track_inventory?: boolean;
  stock_quantity?: number | null;
  low_stock_threshold?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  subtotal?: number;
}

export interface Order {
  id: string;
  vendor_id: string;
  customer_id: string | null;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  notes: string | null;
  whatsapp_msg_id: string | null;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, "name" | "phone" | "address" | "email"> | null;
  order_items?: OrderItem[];
}

export interface Delivery {
  id: string;
  order_id: string;
  courier: string | null;
  tracking_id: string | null;
  delivery_status: DeliveryStatus;
  dispatched_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  orders?: Pick<Order, "id" | "order_status" | "total_amount" | "created_at"> & {
    customers?: Pick<Customer, "name" | "phone"> | null;
  };
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderDraft {
  id: string;
  workspace_id: string;
  inbound_message_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  items: Array<{ name: string; quantity: number; unitPrice?: number }>;
  notes: string | null;
  confidence: number | null;
  status: "pending_review" | "approved" | "rejected" | "converted";
  reviewed_at: string | null;
  created_order_id: string | null;
  created_at: string;
}

export interface DailyMetrics {
  ordersToday: number;
  revenueToday: number;
  pendingDeliveries: number;
  newOrders: number;
}
