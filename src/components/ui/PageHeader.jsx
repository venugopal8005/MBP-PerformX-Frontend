export default function PageHeader({
  title,
  subtitle,
  action,
  meta,
}) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-slate-900">
            {title}
          </h1>

          {meta && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
              {meta}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div>{action}</div>}
    </div>
  );
}