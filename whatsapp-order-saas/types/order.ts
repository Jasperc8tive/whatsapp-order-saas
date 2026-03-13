export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  vendor_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  whatsapp_message_id?: string;
  created_at: string;
  updated_at: string;
}

export type CreateOrderPayload = Omit<Order, "id" | "created_at" | "updated_at">;
export type UpdateOrderPayload = Partial<Pick<Order, "status" | "notes">>;
