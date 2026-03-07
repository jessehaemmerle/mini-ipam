import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        {meta && <p className="mt-2 text-sm text-slate-500">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

