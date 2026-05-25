import { useAuth } from "@/context/AuthContext";

type Action =
  | "create_customer"
  | "edit_customer"
  | "delete_record"
  | "create_vehicle"
  | "edit_vehicle"
  | "create_loan"
  | "activate_loan"
  | "close_loan"
  | "cancel_loan"
  | "record_transfer"
  | "log_expense"
  | "edit_kyc_status"
  | "view_all_staff";

const ROLE_PERMISSIONS: Record<string, Action[]> = {
  admin: [
    "create_customer",
    "edit_customer",
    "delete_record",
    "create_vehicle",
    "edit_vehicle",
    "create_loan",
    "activate_loan",
    "close_loan",
    "cancel_loan",
    "record_transfer",
    "log_expense",
    "edit_kyc_status",
    "view_all_staff",
  ],
  manager: [
    "create_customer",
    "edit_customer",
    "create_vehicle",
    "edit_vehicle",
    "create_loan",
    "activate_loan",
    "close_loan",
    "cancel_loan",
    "record_transfer",
    "log_expense",
    "edit_kyc_status",
  ],
  agent: [
    "create_customer",
    "edit_customer",
    "create_vehicle",
    "edit_vehicle",
    "create_loan",
    "cancel_loan",
    "log_expense",
  ],
};

export function usePermission(action: Action): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return (ROLE_PERMISSIONS[user.role] ?? []).includes(action);
}
