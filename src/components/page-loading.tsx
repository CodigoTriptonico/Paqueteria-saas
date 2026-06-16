type PageLoadingProps = {
  /** Ocupa el panel sin bloquear toda la pantalla ni animaciones pesadas. */
  inline?: boolean;
};

export function PageLoading({ inline = false }: PageLoadingProps) {
  if (inline) {
    return (
      <div
        className="grid gap-3 rounded-xl border border-black bg-surface-panel p-4"
        aria-busy="true"
        aria-label="Cargando"
      >
        <div className="skeleton-line h-11 rounded-lg bg-surface-card" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="skeleton-card h-20 rounded-lg border border-black bg-surface-card" />
          <div className="skeleton-card h-20 rounded-lg border border-black bg-surface-card [animation-delay:120ms]" />
          <div className="skeleton-card h-20 rounded-lg border border-black bg-surface-card [animation-delay:240ms]" />
        </div>
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-black bg-surface-panel p-4 shadow-md sm:p-5"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="grid gap-3">
        <div className="skeleton-line h-11 rounded-lg bg-surface-card" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="skeleton-card h-24 rounded-lg border border-black bg-surface-card" />
          <div className="skeleton-card h-24 rounded-lg border border-black bg-surface-card [animation-delay:120ms]" />
          <div className="skeleton-card h-24 rounded-lg border border-black bg-surface-card [animation-delay:240ms]" />
        </div>
        <div className="skeleton-block h-32 rounded-lg bg-surface-inset" />
      </div>
    </section>
  );
}
