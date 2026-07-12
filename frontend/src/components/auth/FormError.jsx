export function FormError({ error }) {
  if (!error) return null;

  return (
    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
      <p>{error.message}</p>
      {error.details?.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {error.details.map((detail, index) => (
            <li key={`${detail.field}-${index}`}>{detail.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
