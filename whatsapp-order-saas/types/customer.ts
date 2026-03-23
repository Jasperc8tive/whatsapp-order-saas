export interface Customer {
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export type CreateCustomerPayload = Omit<Customer, "id" | "created_at" | "updated_at">;
