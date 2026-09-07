import { Spinner } from "@/components/ui/spinner";

/**
 * Full-screen loading state used while auth or route data resolves.
 * Consolidates the spinner markup that was previously repeated across the
 * landing, dashboard, and notebook pages.
 */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2.5">
        <Spinner className="size-4 text-muted-foreground" aria-label={label} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
