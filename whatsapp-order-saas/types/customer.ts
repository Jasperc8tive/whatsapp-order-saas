export interface Customer {
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
  created_at: string;
  updated_at: string;
}

export type CreateCustomerPayload = Omit<Customer, "id" | "total_orders" | "total_spent" | "last_order_at" | "created_at" | "updated_at">;
