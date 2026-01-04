import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

interface WorkspaceSettings {
  defaultCurrency: string;
  defaultCountry: string;
}

interface WorkspaceContextValue {
  settings: WorkspaceSettings;
  isLoading: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  getCurrencySymbol: (currency?: string) => string;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultCurrency: "USD",
  defaultCountry: "US",
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => api.workspace.get(),
    enabled: !!localStorage.getItem("zentla_api_key"),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const settings: WorkspaceSettings = {
    defaultCurrency:
      ((workspace?.settings as Record<string, unknown>)
        ?.defaultCurrency as string) || DEFAULT_SETTINGS.defaultCurrency,
    defaultCountry:
      ((workspace?.settings as Record<string, unknown>)
        ?.defaultCountry as string) || DEFAULT_SETTINGS.defaultCountry,
  };

  const formatCurrency = (amount: number, currency?: string): string => {
    const currencyCode = currency || settings.defaultCurrency;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getCurrencySymbol = (currency?: string): string => {
    const currencyCode = currency || settings.defaultCurrency;
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
    // Extract just the symbol (remove the number)
    return formatted.replace(/[\d.,\s]/g, "").trim();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        settings,
        isLoading,
        formatCurrency,
        getCurrencySymbol,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
