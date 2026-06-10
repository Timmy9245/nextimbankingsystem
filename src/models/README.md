# Models

Domain classes for the NexTim banking system, mirroring the requested
`models/` layout. Each file re-exports the corresponding class from the
canonical implementation at `src/lib/banking/models.ts` so route and
component code can import either way without duplication.

| File                 | Exports                                |
| -------------------- | -------------------------------------- |
| `account.ts`         | `Account` (abstract), `AccountRepository` |
| `savings_account.ts` | `SavingsAccount`                       |
| `current_account.ts` | `CurrentAccount`                       |
| `customer.ts`        | `Customer` (profile DTO)               |
| `transaction.ts`     | Transaction types + error classes      |
| `transfer_service.ts`| `TransferService`                      |
| `loan_service.ts`    | `LoanService`                          |
| `bill_service.ts`    | `BillService`, `PinService`            |

The OOP design — abstraction (`Account`), inheritance (`SavingsAccount`,
`CurrentAccount`), polymorphism (`calculateInterest`), encapsulation
(private fields with getters), and custom exceptions — lives in
`src/lib/banking/models.ts`.