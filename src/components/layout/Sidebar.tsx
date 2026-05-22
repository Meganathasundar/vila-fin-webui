import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Car,
  FileText,
  Wrench,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/vehicles", label: "Vehicles", icon: Car },
  { to: "/loans", label: "Loans", icon: FileText },
  { to: "/service-expenses", label: "Service Expenses", icon: Wrench },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r bg-white">
      <div className="px-6 py-5 border-b">
        <span className="text-xl font-bold text-primary tracking-tight">Vila Fin</span>
        <p className="text-xs text-muted-foreground mt-0.5">Vehicle Loan Portal</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="px-4 py-4 border-t space-y-2">
          <div className="px-1">
            <p className="text-sm font-medium truncate">{user.full_name}</p>
            <div className="mt-1">
              <StatusBadge status={user.role} />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </aside>
  );
}
