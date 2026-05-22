export default function Card({
  children,
  className = "",
}) {
  return (
    <div
      className={`
        rounded-xl border border-slate-200 bg-white p-5
        shadow-[0_1px_2px_rgba(0,0,0,0.04)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}