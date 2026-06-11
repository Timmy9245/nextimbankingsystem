import type { Account } from "@/lib/banking/models";
import { Wallet } from "lucide-react";

export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(amount);
}

export function AccountCard({ account, selected, onSelect, hideBalance }: { account: Account; selected?: boolean; onSelect?: () => void; hideBalance?: boolean }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-2xl p-5 transition-all ${selected ? "ring-2 ring-ring" : "hover:-translate-y-0.5"}`}
      style={{
        background: "var(--gradient-primary)",
        color: "var(--primary-foreground)",
        boxShadow: "var(--shadow-elegant)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70">{account.type} account</p>
          <p className="mt-1 font-mono text-sm opacity-90">{account.accountNumber}</p>
        </div>
        <Wallet className="h-5 w-5 opacity-80" />
      </div>
      <p className="mt-6 text-3xl font-semibold tabular-nums">{hideBalance ? "₦••••••" : formatNaira(account.balance)}</p>
      <p className="mt-1 text-xs opacity-70">
        {account.type === "savings"
          ? `Monthly interest: ${hideBalance ? "₦••••" : formatNaira(account.calculateInterest())}`
          : "Current account · no interest"}
      </p>
    </button>
  );
}