import { AlertTriangle } from "lucide-react";

type ErrorCalloutProps = {
  title: string;
  message: string;
};

export function ErrorCallout({ title, message }: ErrorCalloutProps) {
  return (
    <div className="surface-card rounded-[26px] border border-rose-400/25 bg-[linear-gradient(135deg,rgba(146,28,44,0.14),rgba(22,17,15,0.04))] px-5 py-4 text-sm text-[var(--foreground)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-rose-200">{title}</p>
          <p className="mt-1 leading-6 text-rose-100/90">{message}</p>
        </div>
      </div>
    </div>
  );
}
