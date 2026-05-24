import { AlertTriangle } from "lucide-react";

type ErrorCalloutProps = {
  title: string;
  message: string;
};

export function ErrorCallout({ title, message }: ErrorCalloutProps) {
  return (
    <div className="surface-card rounded-[28px] border border-amber-400/30 bg-[linear-gradient(135deg,rgba(223,242,164,0.13),rgba(181,70,52,0.16))] px-5 py-4 text-sm text-[var(--foreground)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-500">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-1 leading-6 text-app-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}
