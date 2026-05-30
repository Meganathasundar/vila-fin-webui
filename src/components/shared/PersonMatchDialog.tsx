import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Person } from "@/types/api";

interface PersonMatchDialogProps {
  open: boolean;
  persons: Person[];
  onSelect: (person: Person) => void;
  onDismiss: () => void;
}

export function PersonMatchDialog({ open, persons, onSelect, onDismiss }: PersonMatchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Existing Person Found</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {persons.length === 1
            ? "A person with this information is already registered. Select them to reuse the existing record, or dismiss to create a new one."
            : `${persons.length} persons match this information. Select one to use the existing record.`}
        </p>
        <div className="space-y-3 mt-1">
          {persons.map((person) => (
            <div
              key={person.id}
              className="rounded-md border p-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-sm">{person.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {person.phone}
                  {person.alt_phone ? ` · ${person.alt_phone}` : ""}
                  {person.city ? ` · ${person.city}` : ""}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {person.id_type?.replace(/_/g, " ")} · {person.id_number}
                </p>
                <div className="pt-0.5">
                  <StatusBadge status={person.kyc_status ?? "pending"} />
                </div>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => onSelect(person)}>
                Use
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-2" onClick={onDismiss}>
          Create New Person Instead
        </Button>
      </DialogContent>
    </Dialog>
  );
}
