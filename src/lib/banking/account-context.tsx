import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AccountRepository, type Account } from "@/lib/banking/models";

interface AccountContextValue {
  accounts: Account[];
  isLoading: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: Account | undefined;
  showBalance: boolean;
  toggleBalance: () => void;
}

const Ctx = createContext<AccountContextValue | null>(null);

const STORAGE_SELECTED = "nextim:selectedAccountId";
const STORAGE_SHOW = "nextim:showBalance";

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => AccountRepository.listForUser(),
  });

  const [selectedId, setSelectedIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_SELECTED) ?? "";
  });
  const [showBalance, setShowBalance] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_SHOW) !== "0";
  });

  useEffect(() => {
    if (accounts.length === 0) return;
    if (!selectedId || !accounts.some((a) => a.id === selectedId)) {
      setSelectedIdState(accounts[0].id);
    }
  }, [accounts, selectedId]);

  function setSelectedId(id: string) {
    setSelectedIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_SELECTED, id);
  }
  function toggleBalance() {
    setShowBalance((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_SHOW, next ? "1" : "0");
      return next;
    });
  }

  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <Ctx.Provider value={{ accounts, isLoading, selectedId, setSelectedId, selected, showBalance, toggleBalance }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAccountContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccountContext must be used within AccountProvider");
  return v;
}

export function maskNaira() {
  return "₦••••••";
}