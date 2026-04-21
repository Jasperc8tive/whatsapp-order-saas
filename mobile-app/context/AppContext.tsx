import React, { createContext, useContext } from "react";

interface AppContextValue {
  appName: string;
}

const AppContext = createContext<AppContextValue>({
  appName: "WhatsOrder",
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <AppContext.Provider value={{ appName: "WhatsOrder" }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
