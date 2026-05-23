type ErrorCalloutProps = {
  title: string;
  message: string;
};

export function ErrorCallout({ title, message }: ErrorCalloutProps) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-rose-800">{message}</p>
    </div>
  );
}
