// Generated from api-spec.yml v1.7.0

export interface ApiError {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface Profile {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  role?: "admin" | "manager" | "agent";
  is_active?: boolean;
}

export interface SignupRequest {
  phone: string;
  password: string;
  full_name: string;
  email?: string;
  role?: "admin" | "manager" | "agent";
}

export interface SignupResponse {
  tokens?: TokenResponse;
  profile?: Profile;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface CustomerCreate {
  full_name: string;
  phone: string;
  alt_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  id_type: "aadhaar" | "pan" | "passport" | "driving_licence" | "voter_id";
  id_number: string;
}

export interface CustomerUpdate extends CustomerCreate {
  kyc_status: "pending" | "uploaded" | "verified" | "rejected";
}

export interface Customer extends CustomerUpdate {
  id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListMeta {
  limit?: number;
  offset?: number;
  total?: number;
}

export interface CustomerList {
  data?: Customer[];
  meta?: ListMeta;
}

export interface VehicleCreate {
  registration_no: string;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  fuel_type?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "other" | null;
  vehicle_type?: "two_wheeler" | "four_wheeler" | "commercial" | null;
  chassis_no?: string | null;
  engine_no?: string | null;
  vehicle_cost?: string | null;
  purchase_date?: string | null;
  /** Lookup code from vehicle_consultancy list */
  consultancy?: string | null;
  /** Amount paid to acquire the vehicle */
  sale_price?: string | null;
  /** Final price of the vehicle */
  final_price?: string | null;
  vehicle_source?: "lender_stock" | "external_collateral";
  current_owner_id?: string | null;
}

export interface VehicleUpdate extends VehicleCreate {
  current_status: "available" | "loan_active" | "sold";
}

export interface Vehicle extends VehicleUpdate {
  id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  purchase_date?: string | null;
  sale_price?: string | null;
  final_price?: string | null;
}

export interface VehicleList {
  data?: Vehicle[];
  meta?: ListMeta;
}

export interface LoanCreate {
  customer_id: string;
  vehicle_id: string;
  guarantor_id?: string | null;
  loan_type?: "vehicle_sale" | "external_purchase";
  principal_amount: string;
  interest_rate: string;
  tenure_months: number;
  emi_amount: string;
  notes?: string;
}

export interface LoanUpdate {
  loan_type: "vehicle_sale" | "external_purchase";
  principal_amount: string;
  interest_rate: string;
  tenure_months: number;
  emi_amount: string;
  disbursement_date?: string;
  maturity_date?: string;
  status: "draft" | "active" | "closed" | "defaulted" | "cancelled";
  guarantor_id?: string | null;
  notes?: string;
}

export interface Loan extends LoanUpdate {
  id?: string;
  loan_number?: string;
  customer_id?: string;
  vehicle_id?: string;
  guarantor_id?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoanList {
  data?: Loan[];
  meta?: ListMeta;
}

// ── Lookups ──────────────────────────────────────────────────────────────────

// ── Lookup version meta (injected by middleware into every non-lookup response) ──

export interface LookupVersionMeta {
  lookup_version?: number;
  lookup_stale?: boolean;
}

// ── Summary shape returned by GET /api/v1/lookups (bulk) ─────────────────────
// The per-list endpoint (GET /lookups/{code}) returns ListValuesResponse whose
// data array may also include id and is_active from the server even though the
// spec's LookupValueSummary schema omits them — they are kept optional here so
// the admin UI can use them when present without breaking if absent.

export interface LookupValueSummary {
  id?: string;
  code: string;
  label: string;
  meta?: Record<string, unknown> | null;
  sort_order?: number;
  /** Present in per-list response (GET /lookups/{code}); absent in bulk response */
  is_active?: boolean;
}

// ── Grouped response from GET /api/v1/lookups ─────────────────────────────────

export interface AllLookupsResponse {
  data?: {
    lookups?: Record<string, LookupValueSummary[]>;
  };
  meta?: {
    lookup_version?: number;
  };
}

// ── Per-list response from GET /api/v1/lookups/{code} ────────────────────────

export interface ListValuesResponse {
  data?: LookupValueSummary[];
  meta?: {
    lookup_version?: number;
    list?: string;
  };
}

export interface LookupListCreate {
  code: string;
  name: string;
  description?: string | null;
}

export interface LookupListUpdate {
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface LookupList extends LookupListUpdate {
  id?: string;
  code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LookupListDetail extends LookupList {
  values?: LookupValue[];
}

export interface LookupListsResponse {
  data?: LookupList[];
}

export interface LookupValueCreate {
  code: string;
  label: string;
  meta?: Record<string, string> | null;
  sort_order?: number;
}

export interface LookupValueUpdate extends LookupValueCreate {
  is_active: boolean;
}

export interface LookupValue extends LookupValueUpdate {
  id?: string;
  created_at?: string;
  updated_at?: string;
}

// Convenience type for garage meta
export interface GarageMeta {
  address?: string;
  city?: string;
  phone?: string;
}

// ── Costs Incurred ────────────────────────────────────────────────────────────

export type CostType =
  | "maintenance"
  | "repair"
  | "insurance"
  | "tax"
  | "fitness_certificate"
  | "pollution_check"
  | "purchasing_cost"
  | "other";

/** @deprecated Use CostType */
export type ServiceType = CostType;

export interface CostIncurredCreate {
  vehicle_id: string;
  /** Lookup code from cost_type list */
  cost_type: string;
  description?: string | null;
  cost: string;
  service_date: string;
  /** Lookup code from garage list */
  garage?: string | null;
  odometer_reading?: number | null;
}

/** PUT payload — vehicle_id is immutable after creation */
export interface CostIncurredUpdate {
  cost_type: string;
  description?: string | null;
  cost: string;
  service_date: string;
  garage?: string | null;
  odometer_reading?: number | null;
}

export interface CostIncurred extends CostIncurredCreate {
  id?: string;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CostIncurredList {
  data?: CostIncurred[];
  meta?: ListMeta;
}

/** @deprecated Use CostIncurredCreate */
export type ServiceExpenseCreate = CostIncurredCreate;
/** @deprecated Use CostIncurred */
export type ServiceExpense = CostIncurred;
/** @deprecated Use CostIncurredList */
export type ServiceExpenseList = CostIncurredList;
