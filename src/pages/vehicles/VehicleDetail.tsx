import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { getVehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "./VehicleForm";
import { usePermission } from "@/hooks/usePermission";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const canEdit = usePermission("edit_vehicle");

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => getVehicle(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return <p className="text-muted-foreground">Vehicle not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model} (${vehicle.registration_no})`}
        actions={
          canEdit && !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />Edit
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-3 flex-wrap">
        <StatusBadge status={vehicle.current_status ?? "available"} />
        <StatusBadge status={vehicle.vehicle_source ?? "lender_stock"} />
      </div>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Vehicle</CardTitle></CardHeader>
          <CardContent>
            <VehicleForm vehicle={vehicle} onSuccess={() => setEditing(false)} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Vehicle Info</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Registration No", vehicle.registration_no],
                ["Make", vehicle.make],
                ["Model", vehicle.model],
                ["Year", String(vehicle.year)],
                ["Color", vehicle.color ?? "—"],
                ["Fuel Type", vehicle.fuel_type ?? "—"],
                ["Vehicle Type", vehicle.vehicle_type ?? "—"],
                ["Chassis No", vehicle.chassis_no],
                ["Engine No", vehicle.engine_no],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium capitalize">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd><DateDisplay value={vehicle.created_at} /></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Service Expenses</CardTitle>
          <Link to={`/service-expenses/new?vehicle_id=${vehicle.id}`}>
            <Button size="sm" variant="outline">Add Expense</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No service expenses recorded for this vehicle.</p>
        </CardContent>
      </Card>
    </div>
  );
}
