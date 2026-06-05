import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountRepository, BillService, PinService, type BillCategory } from "@/lib/banking/models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/components/banking/AccountCard";
import { ReceiptDialog } from "@/components/banking/Receipt";
import { PinDialog } from "@/components/banking/PinDialog";
import { Smartphone, Wifi, Zap, Tv, Dices, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({ meta: [{ title: "Pay Bills — NexTim" }] }),
  component: Bills,
});

const CATEGORIES: Array<{
  id: BillCategory; label: string; icon: typeof Smartphone;
  providers: string[]; refLabel: string; refPlaceholder: string;
}> = [
  { id: "airtime", label: "Airtime", icon: Smartphone, providers: ["MTN", "Airtel", "Glo", "9mobile"], refLabel: "Phone number", refPlaceholder: "08012345678" },
  { id: "data", label: "Data", icon: Wifi, providers: ["MTN", "Airtel", "Glo", "9mobile", "Spectranet", "Smile"], refLabel: "Phone / device number", refPlaceholder: "08012345678" },
  { id: "electricity", label: "Electricity", icon: Zap, providers: ["EKEDC", "IKEDC", "AEDC", "PHED", "IBEDC", "KEDCO"], refLabel: "Meter number", refPlaceholder: "1234567890" },
  { id: "cable_tv", label: "Cable / TV", icon: Tv, providers: ["DStv", "GOtv", "Startimes", "Showmax"], refLabel: "Smartcard / IUC number", refPlaceholder: "1234567890" },
  { id: "betting", label: "Betting", icon: Dices, providers: ["Bet9ja", "SportyBet", "BetKing", "1xBet", "NairaBet"], refLabel: "Account / user ID", refPlaceholder: "your-username" },
];

function Bills() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => AccountRepository.listForUser() });
  const { data: hasPin } = useQuery({ queryKey: ["has-pin"], queryFn: () => PinService.hasPin() });
  const [receiptId, setReceiptId] = useState<string | null>(null);

  function onPaid(id: string) {
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    if (id) setReceiptId(id);
  }

  if (hasPin === false) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Set up your PIN first</CardTitle>
          <CardDescription>You need a transaction PIN before paying bills.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/settings">Go to Settings</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Pay bills</h1>
        <p className="text-muted-foreground">Airtime, data, electricity, cable TV and betting wallets — all from your NexTim account.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="airtime">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-3xl">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="flex items-center gap-1">
                  <c.icon className="h-4 w-4" /> {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((c) => (
              <TabsContent key={c.id} value={c.id}>
                <BillForm category={c} accounts={accounts} onPaid={onPaid} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
      <ReceiptDialog open={!!receiptId} onOpenChange={(v) => !v && setReceiptId(null)} txId={receiptId} variant="compact" />
    </div>
  );
}

function BillForm({
  category, accounts, onPaid,
}: {
  category: typeof CATEGORIES[number];
  accounts: Awaited<ReturnType<typeof AccountRepository.listForUser>>;
  onPaid: (id: string) => void;
}) {
  const [acctId, setAcctId] = useState(accounts[0]?.id ?? "");
  const [provider, setProvider] = useState(category.providers[0]);
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => { if (!acctId && accounts[0]) setAcctId(accounts[0].id); }, [accounts, acctId]);
  useEffect(() => { setProvider(category.providers[0]); }, [category]);

  function start() {
    if (!acctId) { toast.error("Choose an account"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (ref.trim().length < 3) { toast.error(`${category.refLabel} is required`); return; }
    setPinOpen(true);
  }

  async function pay(pin: string) {
    try {
      const id = await BillService.pay({
        accountId: acctId, amount: Number(amount), category: category.id,
        provider, customerRef: ref.trim(), pin,
      });
      toast.success(`${category.label} payment successful`);
      setAmount(""); setRef("");
      onPaid(id);
    } catch (e) { toast.error((e as Error).message); throw e; }
  }

  const selectedAcct = accounts.find((a) => a.id === acctId);

  return (
    <div className="grid gap-4 sm:grid-cols-2 max-w-2xl pt-4">
      <div className="space-y-2 sm:col-span-2">
        <Label>Pay from</Label>
        <Select value={acctId} onValueChange={setAcctId}>
          <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.accountNumber} · {a.type} · {formatNaira(a.balance)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {category.providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Amount (₦)</Label>
        <Input type="number" min="50" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>{category.refLabel}</Label>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={category.refPlaceholder} maxLength={64} />
      </div>
      <Button onClick={start} className="sm:col-span-2 justify-self-start" disabled={!selectedAcct}>
        Pay {category.label.toLowerCase()}
      </Button>
      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSubmit={pay}
        title={`Confirm ${category.label} payment`}
        description={`You are about to pay ${amount ? formatNaira(Number(amount)) : "—"} to ${provider}.`}
      />
    </div>
  );
}