import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setAuth: (payload: { user: User | null; session: Session | null }) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  setAuth: ({ user, session }) => set({ user, session, loading: false }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    const { supabase } = await import("../services/supabaseClient");
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
