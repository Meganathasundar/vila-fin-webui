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

import ServiceExpenseList from "@/pages/serviceExpenses/ServiceExpenseList";
import ServiceExpenseForm from "@/pages/serviceExpenses/ServiceExpenseForm";

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

              {/* Service Expenses */}
              <Route path="/service-expenses" handle={{ breadcrumb: "Service Expenses" }}>
                <Route index element={<ServiceExpenseList />} />
                <Route path="new" element={<ServiceExpenseForm />} handle={{ breadcrumb: "New" }} />
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
