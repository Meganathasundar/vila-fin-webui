import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  vehicles: "Vehicles",
  loans: "Loans",
  "costs-incurred": "Costs Incurred",
  "lookups": "Lookups",
  new: "New",
};

export function Topbar() {
  const { pathname } = useLocation();

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: PATH_LABELS[seg] ?? seg,
    to: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <header className="h-14 border-b bg-white flex items-center px-6">
      {crumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <span key={crumb.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {i === crumbs.length - 1 ? (
                <span className="text-foreground font-medium">{crumb.label}</span>
              ) : (
                <Link to={crumb.to} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}
