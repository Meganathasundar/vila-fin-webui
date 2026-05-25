import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/context/AuthContext";
import { LookupProvider } from "@/context/LookupContext";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // LookupProvider mounts here — after auth is confirmed — so it can safely
  // call GET /api/v1/lookups with a valid Bearer token.
  // It shows its own minimal loading screen on first load (no cached data).
  // On subsequent loads it reads from localStorage instantly (no flicker).
  return (
    <LookupProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </LookupProvider>
  );
}
