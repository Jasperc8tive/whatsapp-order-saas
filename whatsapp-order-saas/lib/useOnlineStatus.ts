
"use client";
import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof window !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);
  return online;
}
