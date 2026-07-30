export default function InfoPage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b-2 border-malina-line bg-blush/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <a href="/" className="flex items-center">
            <img src="/BeautyPolisa_logo_podstawowe_poziome.png" alt="Beauty Polisa" className="h-9 w-auto" />
          </a>
          <a href="/" className="text-sm font-semibold text-ink-soft transition hover:text-malina">
            ← Strona główna
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-14 md:py-20">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-soft">
          {children ?? (
            <p className="rounded-2xl border-2 border-malina-line bg-white p-6">
              Treść w przygotowaniu.
            </p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t-2 border-malina-line bg-blush py-10 text-sm text-ink-soft">
        <div className="w-full space-y-4 px-6 md:px-12">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-semibold text-ink">
            <a href="/o-nas" className="hover:text-malina">O nas</a>
            <a href="https://auraexpert.pl/regulamin" target="_blank" rel="noopener noreferrer" className="hover:text-malina">Regulamin</a>
            <a href="https://auraexpert.pl/rodo" target="_blank" rel="noopener noreferrer" className="hover:text-malina">RODO</a>
            <a href="https://auraexpert.pl/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="hover:text-malina">Polityka Prywatności</a>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Aura Expert sp. z o.o.</p>
        </div>
      </footer>
    </main>
  );
}
