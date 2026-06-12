import WniosekForm, { Wariant } from "@/components/WniosekForm";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://dhuvykwecsxgchzxufxw.supabase.co";

async function getWarianty(): Promise<Wariant[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-warianty`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

const Heart = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.6 5 6.2 5c2 0 3.6 1.1 4.6 2.7h2.4C14.2 6.1 15.8 5 17.8 5c3.6 0 5.7 3.6 4.2 6.7C19.5 16.3 12 21 12 21z" />
  </svg>
);

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: "Dla kogo jest to ubezpieczenie?", a: "Tax Protect w programie Beauty Polisa jest przeznaczony dla firm o przychodach do 3 mln zł za ostatni zamknięty rok podatkowy — niezależnie od formy prawnej: od jednoosobowej działalności po spółki." },
  { q: "Mam zewnętrzną księgową z polisą OC. Czy to nie wystarczy?", a: "Nie. Odpowiedzialność podatkowa dotyczy podatnika — czyli Ciebie. Odpowiedzialność karnoskarbowa dotyczy osób odpowiedzialnych w firmie (właściciela, członka zarządu). Zgodnie z ustawą o rachunkowości tej odpowiedzialności nie da się przenieść na biuro rachunkowe." },
  { q: "Prowadzę JDG — co dokładnie chroni polisa?", a: "Polisa chroni Cię na wypadek kontroli lub postępowania podatkowego z urzędem, a także zabezpiecza Twoją osobistą odpowiedzialność karnoskarbową jako właściciela." },
  { q: "Czy ubezpieczyciel zapłaci za mnie podatek albo VAT?", a: "Nie — to ryzyko nieubezpieczalne. Podatki płaci się samodzielnie. Polisa pokrywa natomiast koszty obrony, doradcy podatkowego, prawnika oraz refunduje grzywny i mandaty karnoskarbowe." },
  { q: "Czy mandat po kontroli skarbowej jest refundowany?", a: "Tak. Mandat nałożony na podstawie kodeksu karnego skarbowego opłacasz samodzielnie, a ubezpieczyciel refunduje poniesioną stratę. Analogicznie działa to przy mandatach z kontroli Państwowej Inspekcji Pracy (obszar kadrowo-płacowy)." },
  { q: "Mam już trwające postępowanie karnoskarbowe — czy polisa mnie ochroni?", a: "Nie. Postępowania rozpoczęte przed zawarciem umowy lub w okresie karencji nie są objęte ochroną. Dlatego warto ubezpieczyć się zanim cokolwiek się wydarzy." },
  { q: "Czym jest karencja i ile trwa?", a: "Karencja to 21 dni od zawarcia umowy — okres, w którym ubezpieczyciel nie odpowiada za nowe zdarzenia. Po jej upływie ochrona działa w pełnym zakresie." },
  { q: "Co z błędami sprzed zawarcia polisy?", a: "Polisa ma pełne pokrycie retroaktywne. Nie ma znaczenia, kiedy doszło do nieprawidłowego działania — liczy się to, że wypadek ubezpieczeniowy (mandat, grzywna, postępowanie) nastąpił po raz pierwszy w okresie ubezpieczenia." },
  { q: "Czy polisa pokrywa koszty prawnika, ekspertyz i biegłych?", a: "Tak. Pokrywane są koszty wynagrodzenia prawnika oraz koszty ekspertyz i biegłych, jeśli są niezbędne do prawidłowego prowadzenia postępowania, a także koszty stawiennictwa na rozprawach i przesłuchaniach." },
  { q: "Jak szybko wypłacane są środki po zgłoszeniu?", a: "Kodeks cywilny przewiduje termin 30 dni od zgłoszenia. Szkody zgłaszane są do brokera (szkodabr@auraconsulting.pl) lub przez formularze na vero24.pl." },
];

export default async function Page() {
  const warianty = await getWarianty();

  return (
    <main>
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-malina-soft bg-blush/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            Beauty <Heart className="h-5 w-5 text-malina" /> Polisa
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft md:flex">
            <a href="#ochrona" className="hover:text-malina">Co Cię chroni</a>
            <a href="#skladki" className="hover:text-malina">Składki</a>
            <a href="#faq" className="hover:text-malina">Pytania</a>
          </nav>
          <a href="#wniosek" className="rounded-full bg-malina px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-malina-dark">
            Złóż wniosek
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24 md:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-malina shadow-soft">
            <Heart className="h-3.5 w-3.5" /> Tax Protect dla branży beauty
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.08] md:text-6xl">
            Kontrola skarbowa w&nbsp;salonie?{" "}
            <span className="text-malina">Niech to będzie problem Twojego ubezpieczyciela.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Prowadzisz salon, a nie kancelarię podatkową. Gdy odezwie się urząd skarbowy, ZUS albo Inspekcja Pracy —
            ubezpieczyciel organizuje i opłaca doradcę podatkowego oraz prawnika, a grzywny karnoskarbowe refunduje.
            Ty zajmujesz się klientkami.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#wniosek" className="rounded-full bg-malina px-8 py-4 text-base font-semibold text-white shadow-card transition hover:bg-malina-dark">
              Wypełnij wniosek — 3 minuty
            </a>
            <a href="#skladki" className="rounded-full border border-ink/15 bg-white px-8 py-4 text-base font-semibold transition hover:border-malina hover:text-malina">
              Zobacz składki
            </a>
          </div>
          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-5 text-sm md:grid-cols-4">
            {[
              ["Colonnade", "ubezpieczyciel z ratingiem A- (AM Best)"],
              ["Pełne pokrycie", "retroaktywne — liczy się data zdarzenia, nie błędu"],
              ["21 dni", "karencji, potem pełna ochrona"],
              ["0 zł", "z Twojej kieszeni za doradcę przy sporze"],
            ].map(([k, v]) => (
              <div key={k} className="border-l-2 border-malina/40 pl-3">
                <dt className="font-display text-lg font-semibold">{k}</dt>
                <dd className="mt-0.5 leading-snug text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* DLACZEGO */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Księgowa księguje. Odpowiadasz Ty.</h2>
          <p className="mt-4 max-w-3xl text-ink-soft leading-relaxed">
            Polskie prawo nie pozwala przenieść odpowiedzialności podatkowej i karnoskarbowej na biuro rachunkowe —
            nawet jeśli to ono popełniło błąd. Mandat, grzywna albo postępowanie zawsze trafiają do podatnika:
            właścicielki salonu. Tax Protect domyka tę lukę.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Niestabilne przepisy", "Zmieniające się interpretacje i linie orzecznicze sprawiają, że nawet rzetelna firma może mieć spór z fiskusem."],
              ["Kontrole US, ZUS, PIP, PFRON", "Każda z tych instytucji może wszcząć kontrolę z urzędu — a jej obsługa bez wsparcia kosztuje czas i pieniądze."],
              ["Osobiste grzywny", "Kary z kodeksu karnego skarbowego płaci człowiek, nie firma. Polisa refunduje poniesioną stratę."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-blush p-6">
                <h3 className="font-display text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ZAKRES */}
      <section id="ochrona" className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Jedna polisa, podwójna ochrona</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">Tax Protect chroni równolegle Ciebie jako osobę i Twoją firmę jako podatnika.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-8 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-widest text-malina">Sekcja 1 · Dla Ciebie</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">Ochrona karnoskarbowa właścicielki i zespołu</h3>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-soft">
                {[
                  "Koszty obrony w postępowaniach karnoskarbowych i karnych",
                  "Koszty postępowania przygotowawczego (przesłuchania, dochodzenia)",
                  "Refundacja grzywien i kar nałożonych w postępowaniu karnoskarbowym",
                  "Koszty porady prawnej — zanim sprawa się rozkręci",
                  "Postępowania porządkowe i kary porządkowe przy kontrolach",
                  "Koszty odzyskania dobrego imienia i wsparcie psychologiczne",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Heart className="mt-1 h-4 w-4 shrink-0 text-malina" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-ink p-8 text-white shadow-soft">
              <p className="text-xs font-bold uppercase tracking-widest text-malina-soft">Sekcja 2 · Dla Twojej firmy</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">Bezgotówkowa obsługa sporów z urzędami</h3>
              <p className="mt-1 text-sm text-malina-soft font-semibold">⚠ Zakres obejmuje 1 spór podatkowy rocznie. Więcej sporów lub wyższe potrzeby — wycena indywidualna.</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-white/85">
                {[
                  "Doradca podatkowy przy kontroli podatkowej i celno-skarbowej — organizuje i opłaca ubezpieczyciel",
                  "Reprezentacja w postępowaniach podatkowych przed urzędem i sądem",
                  "Obsługa kontroli i postępowań ZUS, PIP oraz PFRON",
                  "Asysta podatkowa: szybkie odpowiedzi na problemy podatkowe",
                  "Wsparcie przy czynnościach sprawdzających i wnioskach do KIS",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Heart className="mt-1 h-4 w-4 shrink-0 text-malina" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-6 text-sm leading-relaxed text-ink-soft">
            <strong className="mb-3 block text-ink">Wyłączenia z ochrony (wyciąg z OWU § 8–9)</strong>
            <ul className="grid gap-1.5 md:grid-cols-2">
              {[
                "Zapłata samego podatku, VAT, składek ZUS/KRUS — ryzyko nieubezpieczalne",
                "Grzywny i kary z Kodeksu Karnego (polisa obejmuje wyłącznie Kodeks Karny Skarbowy)",
                "Kary administracyjne nałożone przez organy inne niż wskazane w zakresie",
                "Postępowania wszczęte lub zdarzenia, które wystąpiły przed zawarciem umowy",
                "Postępowania wszczęte w 21-dniowym okresie karencji od daty zawarcia umowy",
                "Sprawy i postępowania toczące się poza terytorium Rzeczypospolitej Polskiej",
                "Działanie umyślne lub rażące niedbalstwo Ubezpieczonego",
                "Czyny stanowiące przestępstwa niefiskalne (wyłudzenia, pranie pieniędzy itp.)",
                "Firmy o przychodach powyżej 3 000 000 zł — wymagana indywidualna ocena ryzyka",
                "Sekcja 2: wyłącznie 1 spór podatkowy rocznie — kolejne spory wymagają indywidualnej wyceny",
              ].map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-0.5 shrink-0 text-gold">✕</span>{t}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs">Pełna treść wyłączeń: Załącznik 002BR do OWU Tax Protect zatwierdzonego przez Colonnade Insurance S.A. Oddział w Polsce, obowiązującego od 26.01.2023 r.</p>
          </div>
        </div>
      </section>

      {/* JAK DZIAŁA */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Jak to działa</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["Wypełniasz wniosek", "Podajesz NIP, nazwę działalności i przychody. Zajmie Ci to mniej czasu niż jeden manicure hybrydowy."],
              ["Wystawiamy polisę", "Sprawdzamy wniosek i potwierdzamy ochronę — zwykle w 1–2 dni robocze. Składkę opłacasz raz w roku."],
              ["Urząd? Dzwonisz do nas", "Zgłaszasz sprawę, a ubezpieczyciel organizuje doradcę podatkowego lub prawnika i pokrywa koszty."],
            ].map(([t, d], i) => (
              <div key={t} className="relative rounded-2xl bg-blush p-7">
                <span className="font-display text-4xl font-semibold text-malina/30">{i + 1}</span>
                <h3 className="mt-2 font-display text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SKŁADKI + FORM */}
      <section id="skladki" className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Wybierz wariant i złóż wniosek</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Składka roczna, bez ukrytych kosztów, bez udziałów własnych dla osób ubezpieczonych. Dla firm o przychodach do 3 mln zł.
          </p>
          <WniosekForm warianty={warianty} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center font-display text-3xl font-semibold md:text-4xl">Pytania, które słyszymy najczęściej</h2>
          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((f) => (
              <details key={f.q} className="faq rounded-2xl border border-malina-soft bg-blush/60 px-6 py-4 open:bg-blush">
                <summary className="flex items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="faq-chevron text-xl text-malina transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-malina-soft bg-blush py-12 text-sm text-ink-soft">
        <div className="mx-auto max-w-6xl space-y-6 px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              Beauty <Heart className="h-4 w-4 text-malina" /> Polisa
            </span>
            <span>Ubezpieczyciel: Colonnade Insurance S.A. Oddział w Polsce · rating A- (AM Best)</span>
          </div>
          <p className="max-w-4xl text-xs leading-relaxed">
            Beauty Polisa to program ubezpieczeniowy dystrybuowany przez Aura Expert sp. z o.o. z siedzibą w Warszawie,
            ul. Bolkowska 2A/28, 01-466 Warszawa, KRS 0000599840, NIP 5242793544 — agenta ubezpieczeniowego wpisanego do
            rejestru agentów KNF pod nr 11229690/A, działającego m.in. na rzecz Colonnade Insurance Société Anonyme Oddział
            w Polsce. Niniejsza strona ma charakter marketingowy. Pełne informacje o zakresie ochrony, ograniczeniach
            i wyłączeniach znajdują się w „Ogólnych warunkach ubezpieczenia ochrony skarbowej i podatkowej Tax Protect”
            z 25.01.2023 r. oraz w dokumencie zawierającym informacje o produkcie ubezpieczeniowym. Administratorem danych
            osobowych podanych we wniosku jest Aura Expert sp. z o.o. — szczegóły w nocie informacyjnej RODO
            (kontakt z IOD: iod@auraexpert.pl).
          </p>
          <p className="text-xs">© {new Date().getFullYear()} Aura Expert sp. z o.o. · Reklamacje: reklamacje@auraexpert.pl · tel. +48 504 400 901</p>
        </div>
      </footer>
    </main>
  );
}
