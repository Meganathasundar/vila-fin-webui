import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "./VehicleForm";

export default function VehicleNew() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Vehicle" />
      <Card>
        <CardHeader><CardTitle>Vehicle Details</CardTitle></CardHeader>
        <CardContent>
          <VehicleForm />
        </CardContent>
      </Card>
    </div>
  );
}
