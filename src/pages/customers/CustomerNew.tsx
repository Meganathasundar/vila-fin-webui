import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerForm } from "./CustomerForm";

export default function CustomerNew() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Customer" />
      <Card>
        <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
        <CardContent>
          <CustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
