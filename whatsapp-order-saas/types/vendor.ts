export interface Vendor {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  phone?: string;
  logo_url?: string;
  whatsapp_number?: string;
  plan: "starter" | "growth" | "pro";
  created_at: string;
  updated_at: string;
}
