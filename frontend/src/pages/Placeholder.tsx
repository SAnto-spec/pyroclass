interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="px-3 py-6 sm:px-6 sm:py-8">
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          {description ?? "This view will be implemented in a later step."}
        </p>
      </div>
    </div>
  );
}
