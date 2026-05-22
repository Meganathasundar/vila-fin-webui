// Generated from api-spec.yml

export interface Error {
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
  color?: string;
  fuel_type?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "other";
  vehicle_type?: string;
  chassis_no: string;
  engine_no: string;
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
}

export interface VehicleList {
  data?: Vehicle[];
  meta?: ListMeta;
}

export interface LoanCreate {
  customer_id: string;
  vehicle_id: string;
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
  notes?: string;
}

export interface Loan extends LoanUpdate {
  id?: string;
  loan_number?: string;
  customer_id?: string;
  vehicle_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoanList {
  data?: Loan[];
  meta?: ListMeta;
}
