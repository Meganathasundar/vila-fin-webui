# Vila Fin — Web UI

A production-grade Vehicle Loan SaaS portal for lender staff (agents, managers, admins). Built with React + Vite + TypeScript, backed by the Vila Fin Go API.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Module Overview](#module-overview)
- [Role-Based Access Control](#role-based-access-control)
- [API Integration](#api-integration)
- [Key Design Decisions](#key-design-decisions)

---

## Features

- **Authentication** — Phone + password login, JWT access tokens (in-memory), refresh tokens (httpOnly cookie), silent refresh on 401
- **Customers** — Create, view and update customers with KYC status tracking
- **Vehicles** — Register vehicles, inline edit, column chooser on list view, purchase date tracking
- **Costs Incurred** — Log all costs against a vehicle (maintenance, repair, insurance, purchasing cost, etc.); vehicle cost displayed as cumulative sum of all entries
- **Loans** — Create loan drafts, view loan details
- **Role-Based Access** — Three roles (admin / manager / agent) each with a defined permission set enforced in the UI
- **INR Currency formatting** — Lakh-aware formatting using `Intl.NumberFormat`
- **Pagination** — Server-side pagination across all list views
- **Toast notifications** — Success and error feedback on all mutations

---

## Tech Stack

| Concern | Library / Tool |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5 (strict) |
| Routing | React Router v6 (`BrowserRouter`) |
| Server state | TanStack Query v5 |
| Table | TanStack Table v8 |
| Forms | React Hook Form v7 + Zod v3 |
| HTTP | Axios (with interceptor-based silent refresh) |
| UI components | shadcn/ui (manual) + Radix UI primitives |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Toasts | Sonner |
| Date formatting | date-fns v4 |

---

## Project Structure

```
vila-fin-webui/
├── public/
├── src/
│   ├── api/                    # Axios API functions per resource
│   │   ├── client.ts           # Axios instance, token handling, interceptors
│   │   ├── auth.ts
│   │   ├── customers.ts
│   │   ├── vehicles.ts
│   │   ├── loans.ts
│   │   └── costsIncurred.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx    # Sidebar + Topbar wrapper
│   │   │   ├── Sidebar.tsx     # Nav links + user info
│   │   │   └── Topbar.tsx      # Breadcrumb bar
│   │   ├── shared/
│   │   │   ├── DataTable.tsx   # TanStack Table wrapper with pagination
│   │   │   ├── StatusBadge.tsx # Color-coded badge for enums
│   │   │   ├── CurrencyDisplay.tsx  # INR lakh formatting
│   │   │   ├── DateDisplay.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   └── ui/                 # shadcn/ui primitives (button, input, card…)
│   ├── context/
│   │   └── AuthContext.tsx     # User session, login/logout, token storage
│   ├── hooks/
│   │   ├── usePermission.ts    # RBAC hook
│   │   └── useDebounce.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── customers/
│   │   │   ├── CustomerList.tsx
│   │   │   ├── CustomerDetail.tsx
│   │   │   ├── CustomerNew.tsx
│   │   │   └── CustomerForm.tsx
│   │   ├── vehicles/
│   │   │   ├── VehicleList.tsx   # List with column chooser
│   │   │   ├── VehicleDetail.tsx # Info + inline edit + costs incurred
│   │   │   ├── VehicleNew.tsx
│   │   │   └── VehicleForm.tsx   # Create / edit, auto-logs purchasing cost
│   │   ├── loans/
│   │   │   ├── LoanList.tsx
│   │   │   ├── LoanDetail.tsx
│   │   │   └── LoanForm.tsx
│   │   └── costsIncurred/
│   │       ├── CostIncurredList.tsx
│   │       └── CostIncurredForm.tsx
│   ├── types/
│   │   └── api.d.ts            # Hand-typed from OpenAPI spec v1.2.0
│   ├── utils/
│   │   ├── currency.ts         # INR lakh formatter
│   │   ├── date.ts
│   │   └── emi.ts              # Reducing-balance EMI calculator
│   ├── App.tsx                 # Route definitions
│   ├── main.tsx
│   ├── index.css               # Tailwind base + CSS variables
│   └── vite-env.d.ts
├── .env.local                  # Local dev overrides (gitignored)
├── .env.production             # Production API URL
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- The Vila Fin Go backend running locally (default `http://localhost:8080`)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd vila-fin-webui

# Install dependencies
npm install

# Create local env file
cp .env.production .env.local
# Then edit .env.local and set VITE_API_BASE_URL=http://localhost:8080/api/v1

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Vila Fin API | `http://localhost:8080/api/v1` |
| `WEBUI_PORT` | Host port when running via Docker (default: `5173`) | `8080` |

Vite loads env files based on the run mode, merged in this order (later files take precedence):

| File | Loaded when |
|---|---|
| `.env` | Always |
| `.env.development` | `npm run dev` (default mode) |
| `.env.staging` | `npm run dev -- --mode staging` |
| `.env.production` | `npm run build` (default mode) |
| `.env.local` | Always — local machine overrides, never committed |

Create `.env.local` at the project root for local development:

```env
# .env.local
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

To build for a specific mode:

```bash
npm run build -- --mode staging
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

---

## Docker Deployment

### Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: Node (build) → nginx (serve) |
| `docker-compose.yml` | Single-service compose for easy deployment |
| `nginx.conf` | Nginx config with React Router (`try_files`) support |
| `.env.example` | Template — copy to `.env.local` / `.env.production` etc. |

### Quick deploy

```bash
# 1. Copy and fill in your environment file
cp .env.example .env.production
# Edit VITE_API_BASE_URL in .env.production

# 2. Build and start
docker compose --env-file .env.production up -d --build
```

App runs at `http://localhost:5173` (change `WEBUI_PORT` in the env file to use a different port).

### Deploying to different environments

Docker Compose reads only `.env` by default. Use `--env-file` to choose which file to load:

```bash
# Local
docker compose --env-file .env.local up -d --build

# Staging
docker compose --env-file .env.staging up -d --build

# Production
docker compose --env-file .env.production up -d --build
```

### Useful Docker commands

```bash
# View logs
docker compose logs -f

# Stop the container
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

> **Note:** `VITE_API_BASE_URL` is baked into the JS bundle at build time by Vite.
> Changing it requires a rebuild (`--build`).

---

## Module Overview

### Authentication

- Login uses `POST /api/v1/auth/login` (phone + password)
- Access token stored **in-memory** (never in localStorage) via `setAccessToken()`
- Refresh token stored in an **httpOnly cookie** — sent automatically by the browser
- Axios request interceptor attaches `Authorization: Bearer <token>` to every request
- Axios response interceptor catches `401`, calls `POST /api/v1/auth/refresh`, and replays the original request transparently
- On refresh failure the user is redirected to `/login`

### Vehicles

- **List** — server-side paginated table with filters (status, source, reg no) and a **column chooser** (Columns button, top right of filters)
- **Detail** — vehicle info card, inline edit form, Costs Incurred section with numbered list and cumulative total
- **Create** — entering a Vehicle Cost auto-generates a `purchasing_cost` entry under Costs Incurred
- **Vehicle Cost displayed** = cumulative sum of all Costs Incurred entries (not the raw field value)

### Costs Incurred

- Replaces "Service Expenses" (API endpoint: `/api/v1/costs-incurred`)
- Cost types: Purchasing Cost, Maintenance, Repair, Insurance, Tax, Fitness Certificate, Pollution Check, Other
- Accessible from the sidebar or via "Add Cost" button on any vehicle detail page (pre-fills vehicle ID)
- Costs are listed with sequential numbering on the vehicle detail page

### Loans

- Draft 뿯↽ Active 뿯↽ Closed/Defaulted/Cancelled workflow
- EMI calculated client-side using reducing-balance method (`src/utils/emi.ts`)

### Customers

- Full CRUD with KYC status (`pending 뿯↽ uploaded 뿯↽ verified 뿯↽ rejected`)
- ID types: Aadhaar, PAN, Passport, Driving Licence, Voter ID

---

## Role-Based Access Control

Permissions are enforced via the `usePermission(action)` hook which reads the logged-in user's role from `AuthContext`.

| Permission | Admin | Manager | Agent |
|---|:---:|:---:|:---:|
| `create_customer` | ✓ | ✓ | ✓ |
| `edit_customer` | ✓ | ✓ | ✓ |
| `create_vehicle` | ✓ | ✓ | ✓ |
| `edit_vehicle` | ✓ | ✓ | ✓ |
| `create_loan` | ✓ | ✓ | ✓ |
| `cancel_loan` | ✓ | ✓ | ✓ |
| `log_expense` | ✓ | ✓ | ✓ |
| `activate_loan` | ✓ | ✓ | — |
| `close_loan` | ✓ | ✓ | — |
| `record_transfer` | ✓ | ✓ | — |
| `edit_kyc_status` | ✓ | ✓ | — |
| `delete_record` | ✓ | — | — |
| `view_all_staff` | ✓ | — | — |

---

## API Integration

All API calls are in `src/api/`. The Axios client is configured in `src/api/client.ts`.

Types are hand-maintained in `src/types/api.d.ts`, derived from the OpenAPI spec (`api-spec.yml`, currently v1.2.0).

### Updating types after a spec change

1. Open `api-spec.yml` and `src/types/api.d.ts` side by side
2. Add/rename/remove fields to match the new spec
3. Run `npm run build` to catch any TypeScript errors introduced by the change
4. Update any API functions in `src/api/` that use renamed fields

### Key API endpoints

| Resource | Endpoint |
|---|---|
| Auth | `POST /api/v1/auth/login` 뿯½ `POST /api/v1/auth/refresh` 뿯½ `GET /api/v1/auth/me` |
| Customers | `GET/POST /api/v1/customers` 뿯½ `GET/PUT /api/v1/customers/{id}` |
| Vehicles | `GET/POST /api/v1/vehicles` 뿯½ `GET/PUT /api/v1/vehicles/{id}` |
| Loans | `GET/POST /api/v1/loans` 뿯½ `GET/PUT /api/v1/loans/{id}` |
| Costs Incurred | `GET/POST /api/v1/costs-incurred` 뿯½ `GET /api/v1/costs-incurred/{id}` |

---

## Key Design Decisions

**`BrowserRouter` instead of Data Router** — `useMatches()` requires a Data Router and crashes with `BrowserRouter`. Breadcrumbs are built from `useLocation()` + a `PATH_LABELS` map instead.

**Access token in memory** — Prevents XSS token theft. The trade-off is that a hard page refresh requires a silent refresh round-trip, which the Axios interceptor handles automatically.

**Zod `z.preprocess` for numeric optional fields** — Raw `z.coerce.number().optional()` coerces empty string `""` to `0`, which gets sent to the API unintentionally. `z.preprocess((v) => v === "" ? undefined : Number(v), z.number().optional())` returns `undefined` for blank inputs.

**Costs Incurred cumulative total** — `vehicle_cost` on the Vehicle record seeds the initial purchase entry. The displayed "Vehicle Cost" figure is computed client-side by summing all `CostIncurred.cost` values so it automatically reflects every subsequent expense without needing a separate backend aggregate endpoint.

**Decimal strings for money** — The API accepts and returns monetary values as decimal strings (e.g. `"350000.00"`). The UI uses `.toFixed(2)` before every POST/PUT to guarantee two decimal places.
