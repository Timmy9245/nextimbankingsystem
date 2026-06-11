import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountRepository, TransferService, type Account, type AccountType } from "@/lib/banking/models";
import { useAccountContext } from "@/lib/banking/account-context";
import { AccountCard, formatNaira } from "@/components/banking/AccountCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDown, ArrowUp, ArrowRightLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ReceiptDialog } from "@/components/banking/Receipt";
import { PinDialog } from "@/components/banking/PinDialog";
import { PinService } from "@/lib/banking/models";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NexTim" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { accounts, isLoading, selectedId, setSelectedId, selected, showBalance, toggleBalance } = useAccountContext();
  const { data: hasPin } = useQuery({ queryKey: ["has-pin"], queryFn: () => PinService.hasPin() });
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  function refresh() { qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); }

  function showReceipt(id: string) { if (id) setReceiptId(id); }

  return (
    <div className="space-y-8">
      {hasPin === false && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Set up your transaction PIN</CardTitle>
            <CardDescription>
              You need a 4-digit PIN before you can deposit, withdraw, transfer or pay bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/settings">Set up PIN</Link></Button>
          </CardContent>
        </Card>
      )}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold tabular-nums">
              {showBalance ? formatNaira(totalBalance) : "₦••••••"}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBalance}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
              title={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <OpenAccountButton onOpened={refresh} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <Card className="text-center p-10">
          <CardTitle>Open your first account</CardTitle>
          <CardDescription className="mt-2">Choose savings or current to start banking.</CardDescription>
          <div className="mt-6"><OpenAccountButton onOpened={refresh} /></div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                selected={a.id === selectedId}
                onSelect={() => setSelectedId(a.id)}
                hideBalance={a.id === selectedId && !showBalance}
              />
            ))}
          </div>

          {selected && <Actions account={selected} accounts={accounts} onDone={refresh} onReceipt={showReceipt} />}
        </>
      )}
      <ReceiptDialog open={!!receiptId} onOpenChange={(v) => !v && setReceiptId(null)} txId={receiptId} variant="compact" />
    </div>
  );
}

function OpenAccountButton({ onOpened }: { onOpened: () => void }) {
  const [type, setType] = useState<AccountType>("savings");
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      await AccountRepository.open(type);
      toast.success(`${type === "savings" ? "Savings" : "Current"} account opened`);
      onOpened();
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <div className="flex items-center gap-2">
      <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="savings">Savings</SelectItem>
          <SelectItem value="current">Current</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={open} disabled={loading}><Plus className="h-4 w-4 mr-1" />Open account</Button>
    </div>
  );
}

function Actions({ account, accounts, onDone, onReceipt }: { account: Account; accounts: Account[]; onDone: () => void; onReceipt: (id: string) => void }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState<{ run: (pin: string) => Promise<string>; label: string; amount: number } | null>(null);

  function ask(label: string, amount: number, run: (pin: string) => Promise<string>) {
    setPending({ run, label, amount });
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    if (!pending) return;
    try {
      const id = await pending.run(pin);
      toast.success(`${pending.label} successful`);
      onDone();
      onReceipt(id);
      setPending(null);
    } catch (e) { toast.error((e as Error).message); throw e; }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Move money</CardTitle>
        <CardDescription>
          Acting on <span className="font-mono">{account.accountNumber}</span> · balance {formatNaira(account.balance)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="deposit"><ArrowDown className="h-4 w-4 mr-1" />Deposit</TabsTrigger>
            <TabsTrigger value="withdraw"><ArrowUp className="h-4 w-4 mr-1" />Withdraw</TabsTrigger>
            <TabsTrigger value="transfer"><ArrowRightLeft className="h-4 w-4 mr-1" />Transfer</TabsTrigger>
          </TabsList>
          <TabsContent value="deposit"><AmountForm label="Deposit" onSubmit={(amt, desc) => {
            ask("Deposit", amt, (pin) => TransferService.deposit(account.id, amt, pin, desc));
          }} /></TabsContent>
          <TabsContent value="withdraw"><AmountForm label="Withdraw" onSubmit={(amt, desc) => {
            ask("Withdrawal", amt, (pin) => TransferService.withdraw(account.id, amt, pin, desc));
          }} /></TabsContent>
          <TabsContent value="transfer"><TransferForm account={account} accounts={accounts} onAsk={ask} /></TabsContent>
        </Tabs>
      </CardContent>
      <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSubmit={confirm}
        title={`Confirm ${pending?.label ?? ""}`}
        description={pending ? `Authorise ${formatNaira(pending.amount)}.` : ""} />
    </Card>
  );
}

function AmountForm({ label, onSubmit }: { label: string; onSubmit: (amount: number, desc: string) => void }) {
  function action(form: FormData): void {
    const amount = Number(form.get("amount"));
    const desc = String(form.get("description") ?? "");
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    onSubmit(amount, desc);
  }
  return (
    <form action={action} className="space-y-4 pt-4 max-w-md">
      <div className="space-y-2"><Label>Amount (₦)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
      <div className="space-y-2"><Label>Description (optional)</Label><Input name="description" maxLength={140} /></div>
      <Button type="submit">{label}</Button>
    </form>
  );
}

function TransferForm({ account, accounts, onAsk }: { account: Account; accounts: Account[]; onAsk: (label: string, amount: number, run: (pin: string) => Promise<string>) => void }) {
  function action(form: FormData): void {
    const to = String(form.get("to") ?? "").trim();
    const amount = Number(form.get("amount"));
    const desc = String(form.get("description") ?? "");
    if (!to) { toast.error("Enter destination account number"); return; }
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    onAsk("Transfer", amount, (pin) => TransferService.transfer(account.id, to, amount, pin, desc));
  }
  const others = accounts.filter((a) => a.id !== account.id);
  return (
    <form action={action} className="space-y-4 pt-4 max-w-md">
      <div className="space-y-2">
        <Label>Destination account number</Label>
        <Input name="to" placeholder="VMB0000000001" required />
        {others.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Your other accounts: {others.map((o) => <button key={o.id} type="button"
              onClick={(e) => { (e.currentTarget.closest("form")!.elements.namedItem("to") as HTMLInputElement).value = o.accountNumber; }}
              className="font-mono underline mr-2">{o.accountNumber}</button>)}
          </p>
        )}
      </div>
      <div className="space-y-2"><Label>Amount (₦)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
      <div className="space-y-2"><Label>Description</Label><Input name="description" maxLength={140} /></div>
      <Button type="submit">Send transfer</Button>
    </form>
  );
}