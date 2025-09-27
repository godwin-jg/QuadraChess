import React, { createContext, useContext, ReactNode } from "react";
import { useSettings as useSettingsLogic } from "../hooks/useSettings"; // Rename the original hook import

// Define the shape of the context data
type SettingsContextType = ReturnType<typeof useSettingsLogic>;

// Create the context with a default value of null
const SettingsContext = createContext<SettingsContextType | null>(null);

// Create the Provider component
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settingsData = useSettingsLogic();

  return (
    <SettingsContext.Provider value={settingsData}>
      {children}
    </SettingsContext.Provider>
  );
}

// Create a new custom hook to easily access the context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
