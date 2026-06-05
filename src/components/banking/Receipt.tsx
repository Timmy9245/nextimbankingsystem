import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/components/banking/AccountCard";
import actualLogo from "@/assets/actual_logo.jpg.asset.json";

export interface ReceiptData {
  id: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  reference: string | null;
  description: string | null;
  status: string;
  created_at: string;
  account_number: string | null;
  account_type: string | null;
  owner_name: string | null;
  counterparty_label: "beneficiary" | "sender" | null;
  counterparty_account: string | null;
  counterparty_name: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  deposit: "Cash Deposit",
  withdrawal: "Cash Withdrawal",
  transfer_out: "Money Transfer",
  transfer_in: "Incoming Transfer",
  loan_disbursement: "Loan Disbursement",
  loan_repayment: "Loan Repayment",
};

function mask(num?: string | null) {
  if (!num) return "—";
  const last = num.slice(-4);
  return `•••• ${last}`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function Header() {
  return (
    <div className="flex flex-col items-center gap-1 pt-2">
      <div className="flex items-center gap-2">
        <img src={actualLogo.url} alt="NexTim" className="h-8 w-8 object-contain" style={{ mixBlendMode: "multiply" }} />
        <div className="leading-tight">
          <p className="font-semibold text-base text-foreground">NexTim</p>
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground -mt-0.5">DIGITAL BANKING</p>
        </div>
      </div>
    </div>
  );
}

function SuccessBadge() {
  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={2.25} />
      <p className="text-success font-medium text-sm">Transaction Successful</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground text-right font-medium">{v ?? "—"}</span>
    </div>
  );
}

function CompactBody({ r }: { r: ReceiptData }) {
  const isOut = r.type === "withdrawal" || r.type === "transfer_out" || r.type === "loan_repayment";
  return (
    <div className="px-6 pb-6">
      <SuccessBadge />
      <p className="text-center text-xs text-muted-foreground mt-4 tracking-wider uppercase">Amount</p>
      <p className="text-center text-3xl font-bold mt-1">{formatNaira(Number(r.amount))}</p>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Transaction Details</p>
        <Row k="Transaction Type" v={TYPE_LABEL[r.type] ?? r.type} />
        <Row k="Transaction ID" v={<span className="font-mono text-xs">{r.reference}</span>} />
        <Row k="From Account" v={<>{r.account_type ? r.account_type[0].toUpperCase() + r.account_type.slice(1) : "Account"} {mask(r.account_number)}</>} />
        {r.counterparty_account && (
          <Row k="To Account" v={<>{r.counterparty_name ?? "—"} {mask(r.counterparty_account)}</>} />
        )}
        {r.counterparty_label === "beneficiary" && (
          <Row k="Beneficiary Bank" v="NexTim Digital Banking" />
        )}
        <Row k="Date & Time" v={`${fmtDate(r.created_at)}, ${fmtTime(r.created_at)}`} />
        <Row k="Narration" v={r.description ?? "—"} />
        {!isOut && r.type !== "deposit" && r.type !== "loan_disbursement" && null}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
        Thank you for banking with NexTim
        <br />
        <span className="text-[10px]">www.nextim.com</span>
      </p>
    </div>
  );
}

function DetailedBody({ r }: { r: ReceiptData }) {
  return (
    <div className="px-6 pb-6">
      <Header />
      <SuccessBadge />

      <div className="mt-5 space-y-0">
        <Row k="Transaction Type" v={TYPE_LABEL[r.type] ?? r.type} />
        <Row k="Amount" v={formatNaira(Number(r.amount))} />
        <Row k="Transaction ID" v={<span className="font-mono text-xs">{r.reference}</span>} />
        <Row k="Date" v={fmtDate(r.created_at)} />
        <Row k="Time" v={fmtTime(r.created_at)} />
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <Row k="From Account" v={<>{r.account_type ? r.account_type[0].toUpperCase() + r.account_type.slice(1) + " Account" : "Account"} {mask(r.account_number)}</>} />
        <Row k="Account Name" v={r.owner_name ?? "—"} />
        {r.counterparty_account && <Row k="To Account" v={r.counterparty_account} />}
        {r.counterparty_label === "beneficiary" && <Row k="Beneficiary Name" v={r.counterparty_name ?? "—"} />}
        {r.counterparty_label === "sender" && <Row k="Sender Name" v={r.counterparty_name ?? "—"} />}
        {(r.type === "transfer_in" || r.type === "transfer_out") && <Row k="Beneficiary Bank" v="NexTim Digital Banking" />}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <Row k="Payment Method" v="NexTim Transfer" />
        <Row k="Narration" v={r.description ?? "—"} />
        <Row k="Status" v={<span className="text-success font-semibold">Successful</span>} />
        <Row k="Reference No." v={<span className="font-mono text-xs">{r.reference}</span>} />
        <Row k="Channel" v="NexTim Web Banking" />
        <Row k="Balance After" v={formatNaira(Number(r.balance_after))} />
      </div>

      <div className="mt-5 rounded-lg bg-secondary/60 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Thank you for banking with NexTim.</span>
          <br />
          This is a system generated receipt and does not require a signature.
        </p>
      </div>
    </div>
  );
}

export function ReceiptDialog({
  open,
  onOpenChange,
  txId,
  variant = "compact",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  txId: string | null;
  variant?: "compact" | "detailed";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", txId],
    enabled: open && !!txId,
    queryFn: async (): Promise<ReceiptData> => {
      const { data, error } = await supabase.rpc("get_receipt", { p_tx: txId });
      if (error) throw error;
      return data as ReceiptData;
    },
  });

  function printReceipt() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0 print:shadow-none print:border-0">
        {variant === "detailed" && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border print:hidden">
            <p className="font-semibold text-sm">Transaction Details</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={printReceipt}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {variant === "compact" && <div className="pt-5"><Header /></div>}
        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading receipt…</div>
        ) : variant === "compact" ? (
          <CompactBody r={data} />
        ) : (
          <DetailedBody r={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}