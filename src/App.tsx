import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";

import CustomerList from "@/pages/customers/CustomerList";
import CustomerDetail from "@/pages/customers/CustomerDetail";
import CustomerNew from "@/pages/customers/CustomerNew";

import VehicleList from "@/pages/vehicles/VehicleList";
import VehicleDetail from "@/pages/vehicles/VehicleDetail";
import VehicleNew from "@/pages/vehicles/VehicleNew";

import LoanList from "@/pages/loans/LoanList";
import LoanDetail from "@/pages/loans/LoanDetail";
import LoanForm from "@/pages/loans/LoanForm";

import CostIncurredList from "@/pages/costsIncurred/CostIncurredList";
import CostIncurredForm from "@/pages/costsIncurred/CostIncurredForm";
import LookupManager from "@/pages/lookups/LookupManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppShell />}>
              <Route
                index
                element={<Navigate to="/dashboard" replace />}
                handle={{ breadcrumb: "Home" }}
              />
              <Route
                path="/dashboard"
                element={<Dashboard />}
                handle={{ breadcrumb: "Dashboard" }}
              />

              {/* Customers */}
              <Route path="/customers" handle={{ breadcrumb: "Customers" }}>
                <Route index element={<CustomerList />} />
                <Route path="new" element={<CustomerNew />} handle={{ breadcrumb: "New" }} />
                <Route path=":id" element={<CustomerDetail />} handle={{ breadcrumb: "Detail" }} />
              </Route>

              {/* Vehicles */}
              <Route path="/vehicles" handle={{ breadcrumb: "Vehicles" }}>
                <Route index element={<VehicleList />} />
                <Route path="new" element={<VehicleNew />} handle={{ breadcrumb: "New" }} />
                <Route path=":id" element={<VehicleDetail />} handle={{ breadcrumb: "Detail" }} />
              </Route>

              {/* Loans */}
              <Route path="/loans" handle={{ breadcrumb: "Loans" }}>
                <Route index element={<LoanList />} />
                <Route path="new" element={<LoanForm />} handle={{ breadcrumb: "New" }} />
                <Route path=":id" element={<LoanDetail />} handle={{ breadcrumb: "Detail" }} />
              </Route>

              {/* Lookups */}
              <Route path="/lookups" element={<LookupManager />} handle={{ breadcrumb: "Lookups" }} />

              {/* Costs Incurred */}
              <Route path="/costs-incurred" handle={{ breadcrumb: "Costs Incurred" }}>
                <Route index element={<CostIncurredList />} />
                <Route path="new" element={<CostIncurredForm />} handle={{ breadcrumb: "New" }} />
                <Route path=":id/edit" element={<CostIncurredForm />} handle={{ breadcrumb: "Edit" }} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
