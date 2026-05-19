import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-base font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-4xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function BigAction({
  title,
  text,
  icon: Icon,
  color,
}: {
  title: string;
  text: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <button className="min-h-44 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <span
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-lg text-white ${color}`}
      >
        <Icon className="h-9 w-9" />
      </span>
      <span className="block text-2xl font-black">{title}</span>
      <span className="mt-2 block text-lg font-semibold text-slate-500 dark:text-slate-400">
        {text}
      </span>
    </button>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-2xl font-black">{title}</h3>
      {children}
    </section>
  );
}
