import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLookups } from "@/context/LookupContext";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-green-100 text-green-800 border-green-200",
  loan_active: "bg-blue-100 text-blue-800 border-blue-200",
  sold: "bg-gray-100 text-gray-700 border-gray-200",
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  active: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
  defaulted: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  uploaded: "bg-blue-100 text-blue-800 border-blue-200",
  verified: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  waived: "bg-gray-100 text-gray-700 border-gray-200",
  lender_stock: "bg-green-100 text-green-800 border-green-200",
  external_collateral: "bg-blue-100 text-blue-800 border-blue-200",
  vehicle_sale: "bg-indigo-100 text-indigo-800 border-indigo-200",
  external_purchase: "bg-orange-100 text-orange-800 border-orange-200",
  purchasing_cost: "bg-purple-100 text-purple-800 border-purple-200",
  maintenance: "bg-blue-100 text-blue-800 border-blue-200",
  repair: "bg-orange-100 text-orange-800 border-orange-200",
  insurance: "bg-teal-100 text-teal-800 border-teal-200",
  fitness_certificate: "bg-cyan-100 text-cyan-800 border-cyan-200",
  pollution_check: "bg-lime-100 text-lime-800 border-lime-200",
};

// Local fallback labels for system-enum codes not served by the lookup system.
// If the server adds these to a lookup list, getLookupLabel will override them.
const FALLBACK_LABELS: Record<string, string> = {
  loan_active: "Loan Active",
  lender_stock: "Lender Stock",
  external_collateral: "Ext. Collateral",
  vehicle_sale: "Vehicle Sale",
  external_purchase: "Ext. Purchase",
  fitness_certificate: "Fitness Cert.",
  pollution_check: "Pollution Check",
  purchasing_cost: "Purchasing Cost",
};

function capitalise(code: string | undefined | null): string {
  if (!code) return "";
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string | undefined | null;
  /** Optional lookup list name — if provided, getLookupLabel is tried first */
  listName?: string;
  className?: string;
}

export function StatusBadge({ status, listName, className }: StatusBadgeProps) {
  const { getLookupLabel } = useLookups();

  if (!status) return null;

  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";

  // Resolution priority:
  //  1. Lookup context (dynamic, server-driven) — only if listName provided and value found
  //  2. Local fallback map (static system-enum labels)
  //  3. Capitalise + replace underscores
  let label: string;
  if (listName) {
    const fromContext = getLookupLabel(listName, status);
    label = fromContext !== status ? fromContext : (FALLBACK_LABELS[status] ?? capitalise(status));
  } else {
    label = FALLBACK_LABELS[status] ?? capitalise(status);
  }

  return (
    <Badge variant="outline" className={cn(style, "font-medium capitalize", className)}>
      {label}
    </Badge>
  );
}
