export {
  BankingError,
  InsufficientFundsError,
  InvalidAccountError,
  AuthError,
} from "@/lib/banking/models";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "loan_disbursement"
  | "loan_repayment"
  | "bill_payment";

export interface TransactionRow {
  id: string;
  account_id: string;
  customer_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string | null;
  status: "success" | "failed" | "pending";
  created_at: string;
}