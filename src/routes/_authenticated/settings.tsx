import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PinService } from "@/lib/banking/models";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — NexTim" }] }),
  component: Settings,
});

function Settings() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { PinService.hasPin().then(setHasPin).catch(() => setHasPin(false)); }, []);

  async function save() {
    if (next.length !== 4 || !/^\d{4}$/.test(next)) { toast.error("PIN must be 4 digits"); return; }
    if (next !== confirm) { toast.error("PINs do not match"); return; }
    if (hasPin && current.length !== 4) { toast.error("Enter your current PIN"); return; }
    setLoading(true);
    try {
      await PinService.setPin(next, hasPin ? current : undefined);
      toast.success(hasPin ? "PIN updated" : "Transaction PIN set");
      setCurrent(""); setNext(""); setConfirm("");
      setHasPin(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your transaction security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {hasPin === false ? "Set up your transaction PIN" : "Change transaction PIN"}
          </CardTitle>
          <CardDescription>
            A 4-digit PIN protects every deposit, withdrawal, transfer, loan and bill payment on your account.
            {hasPin && <span className="flex items-center gap-1 mt-1 text-primary"><ShieldCheck className="h-3 w-3" /> PIN is currently active.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasPin && (
            <PinField label="Current PIN" value={current} onChange={setCurrent} />
          )}
          <PinField label={hasPin ? "New PIN" : "Choose a 4-digit PIN"} value={next} onChange={setNext} />
          <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} />
          <Button onClick={save} disabled={loading}>{loading ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <InputOTP maxLength={4} value={value} onChange={onChange} inputMode="numeric" pattern="[0-9]*">
        <InputOTPGroup>
          <InputOTPSlot index={0} className="h-11 w-11" />
          <InputOTPSlot index={1} className="h-11 w-11" />
          <InputOTPSlot index={2} className="h-11 w-11" />
          <InputOTPSlot index={3} className="h-11 w-11" />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}