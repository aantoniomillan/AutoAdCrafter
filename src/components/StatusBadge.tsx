import { cn } from "@/lib/utils";
import { phaseLabel, phaseOf, phaseTone, waitSubs, type Phase } from "@/lib/pub";
import type { Video } from "@/lib/vids";

export function StatusBadge({ status }: { status: Phase }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        phaseTone[status],
      )}
    >
      {phaseLabel[status]}
    </span>
  );
}

export function VidBadge({ vid }: { vid: Video }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <StatusBadge status={phaseOf(vid)} />
      {waitSubs(vid) && (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Esperando subtitulos
        </span>
      )}
    </span>
  );
}
