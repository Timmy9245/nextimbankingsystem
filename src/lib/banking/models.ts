/**
 * OOP layer for the NexTim.
 *
 * Demonstrates:
 *  - Abstraction (abstract Account, abstract Transaction)
 *  - Inheritance (SavingsAccount, CurrentAccount extend Account)
 *  - Polymorphism (calculateInterest overridden per subclass)
 *  - Encapsulation (private fields with getters)
 *  - Custom exceptions
 */
import { supabase } from "@/integrations/supabase/client";

export class BankingError extends Error {
  constructor(message: string) { super(message); this.name = "BankingError"; }
}
export class InsufficientFundsError extends BankingError {
  constructor() { super("Insufficient funds"); this.name = "InsufficientFundsError"; }
}
export class InvalidAccountError extends BankingError {
  constructor(msg = "Invalid account") { super(msg); this.name = "InvalidAccountError"; }
}
export class AuthError extends BankingError {
  constructor() { super("Not authenticated"); this.name = "AuthError"; }
}

export type AccountType = "savings" | "current";

export interface AccountRow {
  id: string;
  customer_id: string;
  account_number: string;
  account_type: AccountType;
  balance: number;
  status: string;
  created_at: string;
}

export abstract class Account {
  protected constructor(
    private readonly _id: string,
    private readonly _number: string,
    private _balance: number,
    private readonly _customerId: string,
    private readonly _status: string,
  ) {}

  get id() { return this._id; }
  get accountNumber() { return this._number; }
  get balance() { return this._balance; }
  get customerId() { return this._customerId; }
  get status() { return this._status; }

  abstract get type(): AccountType;
  /** Polymorphic: each subclass returns its own monthly interest figure. */
  abstract calculateInterest(): number;

  static from(row: AccountRow): Account {
    return row.account_type === "savings"
      ? new SavingsAccount(row.id, row.account_number, Number(row.balance), row.customer_id, row.status)
      : new CurrentAccount(row.id, row.account_number, Number(row.balance), row.customer_id, row.status);
  }
}

export class SavingsAccount extends Account {
  get type(): AccountType { return "savings"; }
  /** 4% annual, paid monthly */
  calculateInterest(): number { return +(this.balance * 0.04 / 12).toFixed(2); }
}

export class CurrentAccount extends Account {
  get type(): AccountType { return "current"; }
  /** Current accounts earn no interest */
  calculateInterest(): number { return 0; }
}

/** Service wrappers around the PL/pgSQL stored procedures. */
export class TransferService {
  static async deposit(accountId: string, amount: number, pin: string, description?: string): Promise<string> {
    const { data, error } = await supabase.rpc("sp_deposit", {
      p_account: accountId, p_amount: amount, p_pin: pin, p_description: description ?? "Deposit",
    });
    if (error) throw new BankingError(error.message);
    return (data as { id: string }).id;
  }
  static async withdraw(accountId: string, amount: number, pin: string, description?: string): Promise<string> {
    const { data, error } = await supabase.rpc("sp_withdraw", {
      p_account: accountId, p_amount: amount, p_pin: pin, p_description: description ?? "Withdrawal",
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      throw new BankingError(error.message);
    }
    return (data as { id: string }).id;
  }
  static async transfer(fromId: string, toAccountNumber: string, amount: number, pin: string, description?: string): Promise<string> {
    const { data, error } = await supabase.rpc("sp_transfer", {
      p_from: fromId, p_to_account_number: toAccountNumber,
      p_amount: amount, p_pin: pin, p_description: description ?? "Transfer",
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      if (/not found/i.test(error.message)) throw new InvalidAccountError(error.message);
      throw new BankingError(error.message);
    }
    // sp_transfer returns the transfers row; look up the outgoing tx id by reference.
    const ref = (data as { reference: string }).reference;
    const { data: tx, error: txErr } = await supabase
      .from("transactions").select("id")
      .eq("reference", ref).eq("account_id", fromId).maybeSingle();
    if (txErr || !tx) throw new BankingError(txErr?.message ?? "Receipt unavailable");
    return tx.id as string;
  }
}

export class LoanService {
  static async apply(accountId: string, principal: number, purpose: string, pin: string): Promise<string> {
    const { data, error } = await supabase.rpc("sp_apply_loan", {
      p_account: accountId, p_principal: principal, p_purpose: purpose, p_pin: pin,
    });
    if (error) throw new BankingError(error.message);
    // Returns loans row; fetch disbursement tx id by description/reference prefix.
    const { data: tx } = await supabase
      .from("transactions").select("id")
      .eq("account_id", accountId).eq("type", "loan_disbursement")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return (tx?.id as string) ?? "";
  }
  static async repay(loanId: string, accountId: string, amount: number, pin: string): Promise<string> {
    const { data, error } = await supabase.rpc("sp_repay_loan", {
      p_loan: loanId, p_account: accountId, p_amount: amount, p_pin: pin,
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      throw new BankingError(error.message);
    }
    const { data: tx } = await supabase
      .from("transactions").select("id")
      .eq("account_id", accountId).eq("type", "loan_repayment")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return (tx?.id as string) ?? "";
  }
}

/** PIN management + simulated bill payments. */
export type BillCategory = "airtime" | "data" | "electricity" | "cable_tv" | "betting";

export class PinService {
  static async hasPin(): Promise<boolean> {
    const { data, error } = await supabase.rpc("sp_has_pin");
    if (error) throw new BankingError(error.message);
    return Boolean(data);
  }
  static async setPin(newPin: string, currentPin?: string): Promise<void> {
    const { error } = await supabase.rpc("sp_set_pin", { p_new: newPin, p_current: currentPin ?? null });
    if (error) throw new BankingError(error.message);
  }
}

export class BillService {
  static async pay(args: {
    accountId: string; amount: number; category: BillCategory;
    provider: string; customerRef: string; pin: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc("sp_pay_bill", {
      p_account: args.accountId, p_amount: args.amount, p_category: args.category,
      p_provider: args.provider, p_customer_ref: args.customerRef, p_pin: args.pin,
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      throw new BankingError(error.message);
    }
    return (data as { id: string }).id;
  }
}

/** Thin repository over the accounts table. */
export class AccountRepository {
  static async listForUser(): Promise<Account[]> {
    const { data, error } = await supabase
      .from("accounts").select("*").order("created_at", { ascending: true });
    if (error) throw new BankingError(error.message);
    return (data as AccountRow[]).map(Account.from);
  }
  static async open(type: AccountType): Promise<Account> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError();
    const { data, error } = await supabase
      .from("accounts")
      .insert({ customer_id: user.id, account_type: type, account_number: "" })
      .select().single();
    if (error) throw new BankingError(error.message);
    return Account.from(data as AccountRow);
  }
}