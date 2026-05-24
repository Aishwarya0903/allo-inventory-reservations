import { AlertTriangle } from "lucide-react";

type ErrorCalloutProps = {
  title: string;
  message: string;
};

export function ErrorCallout({ title, message }: ErrorCalloutProps) {
  return (
    <div className="surface-card rounded-[24px] border border-amber-400/25 bg-[linear-gradient(135deg,rgba(223,242,164,0.1),rgba(181,70,52,0.12))] px-4 py-4 text-sm text-[var(--foreground)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-500">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-1 leading-6 text-app-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}
