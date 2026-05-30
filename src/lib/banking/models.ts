/**
 * OOP layer for the Veritas Microfinance Bank.
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
  static async deposit(accountId: string, amount: number, description?: string) {
    const { data, error } = await supabase.rpc("sp_deposit", {
      p_account: accountId, p_amount: amount, p_description: description ?? "Deposit",
    });
    if (error) throw new BankingError(error.message);
    return data;
  }
  static async withdraw(accountId: string, amount: number, description?: string) {
    const { data, error } = await supabase.rpc("sp_withdraw", {
      p_account: accountId, p_amount: amount, p_description: description ?? "Withdrawal",
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      throw new BankingError(error.message);
    }
    return data;
  }
  static async transfer(fromId: string, toAccountNumber: string, amount: number, description?: string) {
    const { data, error } = await supabase.rpc("sp_transfer", {
      p_from: fromId, p_to_account_number: toAccountNumber,
      p_amount: amount, p_description: description ?? "Transfer",
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      if (/not found/i.test(error.message)) throw new InvalidAccountError(error.message);
      throw new BankingError(error.message);
    }
    return data;
  }
}

export class LoanService {
  static async apply(accountId: string, principal: number, purpose: string) {
    const { data, error } = await supabase.rpc("sp_apply_loan", {
      p_account: accountId, p_principal: principal, p_purpose: purpose,
    });
    if (error) throw new BankingError(error.message);
    return data;
  }
  static async repay(loanId: string, accountId: string, amount: number) {
    const { data, error } = await supabase.rpc("sp_repay_loan", {
      p_loan: loanId, p_account: accountId, p_amount: amount,
    });
    if (error) {
      if (/Insufficient/i.test(error.message)) throw new InsufficientFundsError();
      throw new BankingError(error.message);
    }
    return data;
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