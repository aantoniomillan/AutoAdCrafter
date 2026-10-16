import { cn } from "@/lib/utils";
import { statusLabel, type VidStatus } from "@/lib/vids";

const tone: Record<VidStatus, string> = {
  pendiente: "bg-warning/15 text-warning",
  publicado: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: VidStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tone[status])}>
      {statusLabel[status]}
    </span>
  );
}
