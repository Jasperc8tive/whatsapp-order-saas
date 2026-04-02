import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";

import { registerForPushNotificationsAsync, syncPushToken } from "../services/notificationService";
import { supabase } from "../services/supabaseClient";
import { useAuthStore } from "../store/authStore";

export function useBootstrapSession() {
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setAuth({ user: session?.user ?? null, session: session ?? null });
      }

      try {
        const token = await registerForPushNotificationsAsync();
        if (token) await syncPushToken(token);
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    bootstrap();

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ user: session?.user ?? null, session: session ?? null });
    });

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [setAuth]);
}
