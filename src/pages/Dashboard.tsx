import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Car, FileText, AlertCircle, TrendingUp } from "lucide-react";
import { listLoans } from "@/api/loans";
import { listVehicles } from "@/api/vehicles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Loan } from "@/types/api";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: activeLoans, isLoading: loadingLoans } = useQuery({
    queryKey: ["loans", { status: "active" }],
    queryFn: () => listLoans({ status: "active", limit: 100 }),
  });

  const { data: recentLoans, isLoading: loadingRecent } = useQuery({
    queryKey: ["loans", "recent"],
    queryFn: () => listLoans({ limit: 10 }),
  });

  const { data: availableVehicles, isLoading: loadingVehicles } = useQuery({
    queryKey: ["vehicles", { current_status: "available" }],
    queryFn: () => listVehicles({ current_status: "available", limit: 100 }),
  });

  const activeCount = activeLoans?.meta?.total ?? 0;
  const loanBookValue = (activeLoans?.data ?? []).reduce(
    (sum, l) => sum + parseFloat(l.principal_amount ?? "0"),
    0
  );
  const vehicleCount = availableVehicles?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Loans"
          value={activeCount}
          icon={FileText}
          loading={loadingLoans}
        />
        <StatCard
          title="Total Loan Book"
          value={<CurrencyDisplay value={loanBookValue} />}
          icon={TrendingUp}
          loading={loadingLoans}
        />
        <StatCard
          title="Overdue Installments"
          value="—"
          icon={AlertCircle}
        />
        <StatCard
          title="Vehicles Available"
          value={vehicleCount}
          icon={Car}
          loading={loadingVehicles}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRecent ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (recentLoans?.data ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No loans found. Create a loan to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Loan No</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Principal</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentLoans?.data ?? []).map((loan: Loan) => (
                      <tr key={loan.id} className="border-b hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <Link to={`/loans/${loan.id}`} className="text-primary hover:underline font-mono text-xs">
                            {loan.loan_number ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <CurrencyDisplay value={loan.principal_amount} />
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={loan.status} />
                        </td>
                        <td className="px-4 py-2">
                          <DateDisplay value={loan.created_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Installments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Repayment schedule data not yet available from API.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
