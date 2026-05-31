import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Vehicle } from "@/types/api";

interface VehicleMatchDialogProps {
  open: boolean;
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
  onDismiss: () => void;
}

export function VehicleMatchDialog({ open, vehicles, onSelect, onDismiss }: VehicleMatchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Existing Vehicle Found</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {vehicles.length === 1
            ? "A vehicle with this registration number is already registered. Select it to reuse the existing record, or dismiss to register a new one."
            : `${vehicles.length} vehicles match this registration. Select one to use the existing record.`}
        </p>
        <div className="space-y-3 mt-1">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="rounded-md border p-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono font-semibold text-sm">{v.registration_no}</p>
                <p className="text-sm text-muted-foreground">
                  {v.make} {v.model}
                  {v.year ? ` · ${v.year}` : ""}
                  {v.color ? ` · ${v.color}` : ""}
                </p>
                {v.fuel_type && (
                  <p className="text-xs text-muted-foreground capitalize">{v.fuel_type}</p>
                )}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {v.vehicle_source && <StatusBadge status={v.vehicle_source} />}
                  {v.current_status && <StatusBadge status={v.current_status} />}
                </div>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => onSelect(v)}>
                Use
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-2" onClick={onDismiss}>
          Register New Vehicle Instead
        </Button>
      </DialogContent>
    </Dialog>
  );
}
