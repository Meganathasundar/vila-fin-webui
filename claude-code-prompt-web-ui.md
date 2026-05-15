# Claude Code Prompt — Vehicle Loan SaaS Web UI

---

## How to use this file

Open your terminal in the project root and run:

```bash
claude
```

Then paste the entire contents of the **PROMPT** section below.
Attach your OpenAPI spec file in the same message.

---

## PROMPT

---

You are building a production-grade web UI for a **Vehicle Loan SaaS application** used exclusively by **lender staff** (agents and managers). This is not a customer-facing app. Read this entire prompt before writing any code.

---

### Project context

A small-to-mid-size vehicle lending company (NBFC or private lender) uses this application to:

- Onboard borrowers and capture KYC documents
- Register vehicles as either company-owned inventory or external collateral
- Create and manage vehicle loans (two types: company sold the vehicle, or borrower bought elsewhere)
- Track vehicle buy/sell transactions
- Log mechanical service expenses against each vehicle

The **mobile app** (React Native, built separately) is the primary full-featured tool used by field agents. This **web portal** is the lighter desktop companion used by office managers and senior staff. It shares the same backend API. It does **not** need camera capture, push notifications, or offline mode.

---

### Tech stack

- **Frontend framework:** React + Vite
- **Language:** TypeScript (strict mode)
- **UI components:** shadcn/ui + Tailwind CSS
- **HTTP client:** Axios with a central API client instance
- **State management:** TanStack Query (React Query v5) for server state; React Context for auth session only
- **Routing:** React Router v6
- **Form handling:** React Hook Form + Zod validation
- **Table component:** TanStack Table v8
- **Currency/number format:** INR using Indian lakh format (₹1,00,000) throughout
- **Date format:** DD-MM-YYYY throughout the UI
- **Language:** English only

---

### Backend API

- **Framework:** Go with chi router
- **Base URL (local):** `http://localhost:8080/api/v1`
- **Base URL (production):** Read from `VITE_API_BASE_URL` environment variable
- **Auth:** JWT Bearer token. On login the API returns `access_token` and `refresh_token`. Store `access_token` in memory (not localStorage). Store `refresh_token` in an httpOnly cookie. Implement silent token refresh — intercept 401 responses, call `POST /auth/refresh`, retry the original request.
- **OpenAPI spec:** Attached. Generate all API types from the spec using `openapi-typescript`. Do not write API types by hand.

---

### Authentication flow

The backend owns auth entirely (no Supabase, no third-party auth SDK).

**Login page** (`/login`)
- Email + password form
- On success: store `access_token` in React Context + memory, set `refresh_token` cookie, redirect to dashboard
- On failure: show inline error "Invalid email or password"
- No signup page — accounts are created by admins in the backend directly
- No "forgot password" flow in the MVP

**Protected routes**
- All routes except `/login` require a valid `access_token`
- If no token exists on app load, redirect to `/login`
- Role is decoded from the JWT payload (`role` field: `admin`, `manager`, `agent`)

**Auth context** should expose: `user` (id, email, role), `login()`, `logout()`, `accessToken`

---

### Role-based UI rules

| Role | Restrictions |
|------|-------------|
| `admin` | Full access to everything |
| `manager` | Can activate and close loans. Cannot delete records |
| `agent` | Can create customers, vehicles, loans (draft only), log service expenses. Cannot activate/close loans, cannot access other staff's profiles |

Implement these as a `usePermission(action)` hook that returns a boolean. Hide or disable UI elements the current role cannot use — do not show error pages.

---

### Application structure

```
src/
├── api/
│   ├── client.ts          # Axios instance, interceptors, token refresh logic
│   ├── auth.ts            # login, logout, refresh endpoints
│   ├── customers.ts       # customer CRUD endpoints
│   ├── vehicles.ts        # vehicle CRUD endpoints
│   ├── loans.ts           # loan CRUD + status transition endpoints
│   ├── repayments.ts      # repayment schedule endpoints
│   ├── kyc.ts             # KYC document upload/status endpoints
│   └── serviceExpenses.ts # service expense CRUD endpoints
├── components/
│   ├── ui/                # shadcn/ui generated components (do not edit)
│   ├── layout/
│   │   ├── AppShell.tsx   # sidebar + topbar wrapper for authenticated pages
│   │   ├── Sidebar.tsx    # navigation sidebar
│   │   └── Topbar.tsx     # breadcrumb + user menu + logout
│   └── shared/
│       ├── DataTable.tsx  # reusable TanStack Table wrapper with pagination
│       ├── StatusBadge.tsx
│       ├── CurrencyDisplay.tsx   # formats to ₹X,XX,XXX
│       ├── DateDisplay.tsx       # formats to DD-MM-YYYY
│       ├── ConfirmDialog.tsx
│       └── PageHeader.tsx
├── context/
│   └── AuthContext.tsx
├── hooks/
│   ├── usePermission.ts
│   └── useDebounce.ts
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── customers/
│   │   ├── CustomerList.tsx
│   │   ├── CustomerDetail.tsx
│   │   └── CustomerForm.tsx
│   ├── vehicles/
│   │   ├── VehicleList.tsx
│   │   ├── VehicleDetail.tsx
│   │   └── VehicleForm.tsx
│   ├── loans/
│   │   ├── LoanList.tsx
│   │   ├── LoanDetail.tsx
│   │   └── LoanForm.tsx
│   ├── serviceExpenses/
│   │   ├── ServiceExpenseList.tsx
│   │   └── ServiceExpenseForm.tsx
│   └── NotFound.tsx
├── types/
│   └── api.d.ts           # generated from OpenAPI spec
├── utils/
│   ├── currency.ts        # INR lakh format helpers
│   ├── date.ts            # DD-MM-YYYY helpers
│   └── emi.ts             # EMI calculation (reducing balance)
└── main.tsx
```

---

### Page and feature specifications

#### Dashboard (`/`)

A summary view for the logged-in staff member. Show four stat cards at the top:

- **Total active loans** — count of loans with `status = active`
- **Total loan book value** — sum of `principal_amount` for active loans, formatted in INR lakh format
- **Overdue installments** — count of `repayment_schedules` where `status = overdue`
- **Vehicles available** — count of vehicles where `current_status = available`

Below the stat cards show two tables side by side:
- **Recent loans** — last 10 loans created, columns: Loan No, Customer, Vehicle, Principal, Status, Created date
- **Overdue installments** — top 10 by oldest due date, columns: Loan No, Customer, Installment No, Due date, Amount

No charts needed in MVP.

---

#### Customers (`/customers`)

**List page**
- Search by phone number (debounced 300ms)
- Filter by `kyc_status` (All / Pending / Uploaded / Verified / Rejected) using a select dropdown
- Table columns: Full name, Phone, ID type, ID number, KYC status (badge), Created date, Actions (View)
- Pagination: 20 rows per page
- "Add Customer" button (admin + manager + agent)

**Detail page** (`/customers/:id`)
- Customer info card: all fields in a clean read layout
- KYC documents section: list of uploaded documents with type, status badge, and a "View" link that opens the OneDrive file in a new tab (the API returns a short-lived URL)
- Upload KYC document: file picker (accept: image/*, application/pdf), doc type selector, upload button
- Linked loans section: table of loans for this customer (Loan No, Vehicle, Principal, Status)
- Edit button (admin + manager only) — opens the edit form inline or as a drawer

**Form** (create + edit)
Fields: Full name, Phone, Alt phone (optional), Address, City, State, Pincode, ID type (select), ID number, KYC status (edit only — agents cannot change this)

Business rules enforced in the form:
- Phone: 10-digit numeric validation
- ID number: required when ID type is selected
- KYC status change: only `manager` and `admin` can edit this field. Agents see it as read-only text

---

#### Vehicles (`/vehicles`)

**List page**
- Search by registration number
- Filter by `current_status` (All / Available / Loan active / Sold)
- Filter by `vehicle_source` (All / Lender stock / External collateral)
- Table columns: Reg no, Make, Model, Year, Fuel type, Source (badge), Status (badge), Actions (View)
- Pagination: 20 rows per page
- "Add Vehicle" button

**Detail page** (`/vehicles/:id`)
- Vehicle info card with all fields
- **Source badge** prominently displayed: green pill for "Lender Stock", blue pill for "External Collateral"
- **Ownership transfers section** (only shown if `vehicle_source = lender_stock`): table of all transfers — Type, From, To, Price, Date
- "Record Transfer" button: opens a form drawer for buy or sell (admin + manager only)
- **Service expenses section**: table of all expenses for this vehicle — Type, Description, Cost, Date, Garage. "Add Expense" button.
- **Active loan section**: if a loan is active against this vehicle, show a summary card linking to the loan

**Form** (create + edit)
Fields: Registration no, Make, Model, Year (number), Color, Fuel type (select), Vehicle type (select: two_wheeler, four_wheeler, commercial), Chassis no, Engine no, Vehicle source (select — shown only on create, cannot change after creation)

Business rule enforced in the form:
- Registration no, Chassis no, Engine no: unique — if API returns 409, show "already registered" error on the specific field
- Vehicle source cannot be edited after the vehicle is created

**Ownership transfer drawer**
Fields: Transfer type (purchase/sale), From customer (customer search autocomplete — hidden for purchase since lender is buying), To customer (customer search autocomplete — required for sale), Sale price, Transfer date, Notes

---

#### Loans (`/loans`)

**List page**
- Filter by `status` (All / Draft / Active / Closed / Defaulted / Cancelled)
- Filter by `loan_type` (All / Vehicle sale / External purchase)
- Search by loan number
- Table columns: Loan No, Customer, Vehicle (reg no), Loan type (badge), Principal, EMI, Status (badge), Disbursement date, Actions (View)
- Pagination: 20 rows per page
- "Create Loan" button

**Detail page** (`/loans/:id`)
- Loan summary card: all financial fields. Show calculated values:
  - Total payable = `emi_amount × tenure_months`
  - Total interest = Total payable − `principal_amount`
  - Both formatted in INR lakh format
- **Status action bar** (below the summary card):
  - `draft` → "Activate Loan" button (manager + admin only). Clicking shows a confirm dialog: "Activating this loan will generate the full repayment schedule and mark the vehicle as Loan Active. This cannot be undone."
  - `active` → "Mark as Defaulted" and "Close Loan" buttons (manager + admin only), each with a confirm dialog
  - `draft` → "Cancel Loan" button (all roles)
- **Repayment schedule table**: Installment no, Due date, EMI amount, Principal component, Interest component, Outstanding balance, Status (badge). Mark paid button per row — opens a small form: paid date, paid amount (pre-filled with EMI amount). Only shown for `pending` and `overdue` rows.
- **Linked vehicle card**: shows vehicle reg no, make, model, source badge. Clicking navigates to vehicle detail.
- **Linked customer card**: shows customer name, phone, KYC status. Clicking navigates to customer detail.

**Create loan form** (multi-step, 3 steps)

Step 1 — Select customer and vehicle:
- Customer: search autocomplete by phone or name. Show name + phone in results.
- Vehicle: search autocomplete by registration no. Show reg no + make + model + current status. Only show vehicles where `current_status = available`. If selected vehicle is `external_collateral`, show an info banner: "This is an external collateral vehicle. No ownership transfer will be recorded."

Step 2 — Loan details:
- Loan type (auto-selected based on vehicle source but editable): vehicle_sale, external_purchase
- Principal amount (INR, numeric)
- Interest rate (% per annum, decimal, e.g. 12.5)
- Tenure months (integer)
- **Live EMI preview**: as the user types principal, rate, or tenure — calculate and display the EMI in real time using the reducing balance formula below. Show it as a highlighted card: "Estimated EMI: ₹X,XXX/month"
- Notes (optional)

Step 3 — Review and submit:
- Read-only summary of all fields from steps 1 and 2
- Calculated values: EMI, total payable, total interest
- "Create Loan (Draft)" submit button

**EMI calculation (reducing balance method):**
```
monthly_rate = (interest_rate / 100) / 12
emi = principal × monthly_rate × (1 + monthly_rate)^tenure
      ────────────────────────────────────────────────────
              (1 + monthly_rate)^tenure − 1
```
This same formula must be in `src/utils/emi.ts` and used in both the live preview and the review step.

---

#### Service Expenses (`/service-expenses`)

**List page**
- Filter by `vehicle_id` (vehicle registration search autocomplete)
- Filter by `service_type` (All / Maintenance / Repair / Insurance / Tax / Fitness certificate / Pollution check / Other)
- Filter by date range (from date, to date)
- Table columns: Vehicle (reg no), Service type (badge), Description, Cost (INR), Garage, Date, Recorded by, Actions (View bill)
- Pagination: 20 rows per page
- "Log Expense" button

**Form** (create — no edit in MVP)
Fields: Vehicle (search autocomplete by reg no), Service type (select), Description (textarea), Cost (INR numeric), Service date (date picker), Garage name (optional), Odometer reading (optional, integer), Bill photo upload (optional, image/* or PDF)

The bill upload calls the API which stores it in OneDrive. On success show a thumbnail or filename confirmation.

---

### Shared UI behaviours

**API error handling**
- 400: show field-level validation errors from the response body next to each field
- 401: clear auth state, redirect to `/login`
- 403: show a toast "You don't have permission to perform this action"
- 404: show inline "Not found" message within the page, not a full redirect
- 409: show field-level "already exists" error on the relevant field
- 500: show a toast "Something went wrong. Please try again."
- Network error: show a toast "Cannot reach the server. Check your connection."

**Loading states**
- Every data fetch shows a skeleton loader matching the layout of the content (not a spinner)
- Every form submit shows a loading state on the submit button ("Saving…" text + disabled)
- Every status transition button shows a loading state while the API call is in progress

**Toast notifications**
- Use shadcn/ui Sonner (toast) for success and error feedback
- Success: "Customer created successfully", "Loan activated", etc.
- Error: see API error handling above

**Empty states**
- Every list page has an empty state illustration (use a simple SVG inline, no external images) with a contextual message:
  - Customers: "No customers yet. Add your first customer to get started."
  - Vehicles: "No vehicles registered. Add a vehicle to begin."
  - Loans: "No loans found. Create a loan to get started."
  - Service expenses: "No service expenses recorded for this vehicle."

**Navigation sidebar** (desktop, always visible)
Links in order: Dashboard, Customers, Vehicles, Loans, Service Expenses. Active link is visually highlighted. At the bottom: logged-in user's name + role badge + logout button.

**Breadcrumbs** in the topbar: e.g. `Customers / Rajesh Kumar / Edit`

---

### Status badge colour mapping

| Status | Colour |
|--------|--------|
| `available` | Green |
| `loan_active` | Blue |
| `sold` | Gray |
| `draft` | Gray |
| `active` | Green |
| `closed` | Gray |
| `defaulted` | Red |
| `cancelled` | Gray |
| `pending` (KYC) | Yellow |
| `uploaded` | Blue |
| `verified` | Green |
| `rejected` | Red |
| `overdue` (repayment) | Red |
| `paid` | Green |
| `waived` | Gray |
| `lender_stock` | Green |
| `external_collateral` | Blue |
| `vehicle_sale` | Indigo |
| `external_purchase` | Orange |

---

### Environment files

Create the following:

**`.env.local`** (gitignored)
```
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

**`.env.production`**
```
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
```

---

### Initial setup commands

Run these before writing any component code:

```bash
npm create vite@latest vehicle-loan-web -- --template react-ts
cd vehicle-loan-web
npm install

# shadcn/ui
npx shadcn@latest init

# Core dependencies
npm install axios @tanstack/react-query @tanstack/react-table react-router-dom react-hook-form @hookform/resolvers zod sonner date-fns

# Dev dependencies
npm install -D openapi-typescript typescript-eslint prettier

# Generate API types from OpenAPI spec
npx openapi-typescript ./openapi.yaml -o ./src/types/api.d.ts
```

---

### Code quality rules

- All components use TypeScript — no `any` types
- All API calls go through `src/api/client.ts` — no direct `fetch` or `axios` calls in components
- All forms use React Hook Form + Zod schemas — no uncontrolled inputs
- All monetary values pass through `CurrencyDisplay` or the `formatINR()` utility — never formatted inline
- All dates pass through `DateDisplay` or the `formatDate()` utility — never formatted inline
- No hardcoded API URLs — always use the Axios instance which reads from `VITE_API_BASE_URL`
- Components must not exceed 200 lines — extract sub-components if needed
- Use TanStack Query `queryKey` conventions: `['customers', id]`, `['loans', { status, type }]`, etc.

---

### Build the following in this order

1. Project scaffolding (Vite + TypeScript + shadcn/ui init + env files)
2. Generate API types from the OpenAPI spec
3. `src/api/client.ts` — Axios instance + JWT interceptor + refresh logic
4. `AuthContext` + login page + protected route wrapper
5. `AppShell` layout (sidebar + topbar)
6. `usePermission` hook
7. Shared components: `DataTable`, `StatusBadge`, `CurrencyDisplay`, `DateDisplay`, `ConfirmDialog`, `PageHeader`
8. `src/utils/emi.ts` — EMI calculation function with unit tests
9. Dashboard page
10. Customers module (list → detail → form)
11. Vehicles module (list → detail → form → ownership transfer drawer)
12. Loans module (list → detail → multi-step create form)
13. Service expenses module (list → form)

Do not skip steps or reorder them. Each module depends on the shared components from step 7.

---

### What NOT to build

- No customer-facing screens
- No signup or forgot-password pages
- No payment gateway integration
- No SMS or email notification UI
- No charts or analytics beyond the four dashboard stat cards
- No dark mode
- No i18n / translation system
- No mobile-specific layouts (web is desktop-first)

---
