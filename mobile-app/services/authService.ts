import { supabase } from "./supabaseClient";

interface OnboardingPayload {
  businessName: string;
  whatsappNumber: string;
  category: string;
  slug: string;
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async saveOnboarding(payload: OnboardingPayload) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("No authenticated user");

    const { error } = await supabase.from("users").upsert({
      id: user.id,
      business_name: payload.businessName,
      whatsapp_number: payload.whatsappNumber,
      slug: payload.slug,
      phone: payload.whatsappNumber,
      email: user.email,
    });

    if (error) throw error;
  },
};
