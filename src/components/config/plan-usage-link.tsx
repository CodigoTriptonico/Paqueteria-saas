import Link from "next/link";

const PLAN_CONFIG_HREF = "/configuracion?view=organization&tab=plan";

export function PlanUsageLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href={PLAN_CONFIG_HREF}
      className={`text-xs font-black text-emerald-300 underline-offset-2 hover:underline ${className}`}
    >
      Ver plan
    </Link>
  );
}
