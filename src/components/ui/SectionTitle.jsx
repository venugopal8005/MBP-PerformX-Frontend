export default function SectionTitle({
  children,
}) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h2>
  );
}