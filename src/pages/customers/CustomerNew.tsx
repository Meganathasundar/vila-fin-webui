import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PersonForm } from "./CustomerForm";

export default function PersonNew() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Person" />
      <Card>
        <CardHeader><CardTitle>Person Details</CardTitle></CardHeader>
        <CardContent>
          <PersonForm />
        </CardContent>
      </Card>
    </div>
  );
}
