import { textMutedClass } from "@/components/ui-blocks";

type FlowPageHeaderProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function FlowPageHeader({ title, description, action }: FlowPageHeaderProps) {
  return (
    <header className="motion-enter-top text-center">
      <h2 className="text-2xl font-black text-[#f8fafc] sm:text-3xl">{title}</h2>
      {description ? <p className={`mx-auto mt-1 max-w-md ${textMutedClass}`}>{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </header>
  );
}
