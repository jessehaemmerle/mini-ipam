type Props = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
  );
}

