"use client";

import { useEffect, useRef, useState } from "react";

export type Wariant = {
  id: string;
  nazwa: string;
  suma_ubezpieczenia: number;
  podlimit_grzywny: number | null;
  skladka_roczna: number;
  opis: string | null;
  kolejnosc: number;
  przychod_min: number;
  przychod_max: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const SUPABASE_URL = "https://dhuvykwecsxgchzxufxw.supabase.co";

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

function cleanNip(raw: string) { return raw.replace(/[^0-9]/g, ""); }
function isValidNip(raw: string) {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((a, x, i) => a + x * Number(nip[i]), 0) % 11 === Number(nip[9]);
}

const BRACKETS: { label: string; max: number | null }[] = [
  { label: "do 250 000 zł", max: 250_000 },
  { label: "do 500 000 zł", max: 500_000 },
  { label: "do 1 000 000 zł", max: 1_000_000 },
  { label: "do 3 000 000 zł", max: 3_000_000 },
  { label: "powyżej 3 000 000 zł", max: null },
];

const SUMY = [50_000, 100_000];

export default function WniosekForm({ warianty }: { warianty: Wariant[] }) {
  const [bracket, setBracket] = useState<number | null | undefined>(undefined); // undefined = nie wybrano
  const [selectedSuma, setSelectedSuma] = useState<number>(50_000);
  const [nip, setNip] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [regon, setRegon] = useState("");
  const [adres, setAdres] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [osoba, setOsoba] = useState("");
  const [pkd, setPkd] = useState("");
  const [zgody, setZgody] = useState({ prawdziwosc: false, postepowania: false, rodo: false, marketing: false });
  const [gusState, setGusState] = useState<"idle" | "loading" | "ok" | "manual">("idle");
  const [gusWarning, setGusWarning] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsRendered = useRef(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const nipOk = isValidNip(nip);

  useEffect(() => {
    if (!siteKey || tsRendered.current) return;
    const render = () => {
      if (tsRef.current && window.turnstile && !tsRendered.current) {
        tsRendered.current = true;
        window.turnstile.render(tsRef.current, {
          sitekey: siteKey,
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(""),
        });
      }
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [siteKey]);

  // Aktywny wariant = bracket + suma
  const activeWariant = bracket
    ? warianty.find((w) => w.przychod_max === bracket && w.suma_ubezpieczenia === selectedSuma) ?? null
    : null;

  async function lookupGus() {
    if (!nipOk) return;
    setGusState("loading");
    setGusWarning(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-gus?nip=${cleanNip(nip)}`);
      const data = await res.json();
      if (data.found) {
        setNazwa(data.nazwa ?? "");
        setRegon(data.regon ?? "");
        setAdres(data.adres ?? "");
        if (data.pkd) setPkd(data.pkd);
        setGusWarning(data.data_zawieszenia
          ? `⚠️ Według GUS działalność jest zawieszona od ${data.data_zawieszenia}. Ubezpieczenie można wystawić po wznowieniu.`
          : null);
        setGusState("ok");
      } else {
        setGusState("manual");
      }
    } catch {
      setGusState("manual");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!activeWariant) return setError("Wybierz przychód i sumę ubezpieczenia.");
    if (!nipOk) return setError("Podany NIP jest nieprawidłowy.");
    if (nazwa.trim().length < 3) return setError("Podaj nazwę działalności.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Podaj prawidłowy adres e-mail.");
    if (!zgody.prawdziwosc || !zgody.postepowania || !zgody.rodo) return setError("Zaznacz wymagane oświadczenia.");
    if (siteKey && !token) return setError("Potwierdź, że nie jesteś robotem.");

    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-wniosek`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wariant_id: activeWariant.id,
          nip: cleanNip(nip),
          nazwa_firmy: nazwa.trim(),
          regon,
          adres,
          pkd: pkd || undefined,
          przychod: bracket,
          email: email.trim(),
          telefon: telefon.trim(),
          osoba_kontaktu: osoba.trim(),
          zgoda_rodo: zgody.rodo,
          zgoda_prawdziwosc: zgody.prawdziwosc,
          oswiadczenie_brak_postepowan: zgody.postepowania,
          zgoda_marketing: zgody.marketing,
          turnstileToken: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Coś poszło nie tak. Spróbuj ponownie.");
        if (window.turnstile) window.turnstile.reset();
        setToken("");
      } else {
        setDone(true);
      }
    } catch {
      setError("Brak połączenia z serwerem. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div id="wniosek" className="mt-10 rounded-3xl bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-malina-soft text-3xl">💗</div>
        <h3 className="text-2xl font-semibold">Wniosek wysłany — dziękujemy!</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Potwierdzenie znajdziesz w swojej skrzynce e-mail. Odezwiemy się, gdy tylko polisa będzie gotowa —
          zwykle w ciągu 1–2 dni roboczych.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-8" noValidate>

      {/* KROK 1 — PRZYCHODY */}
      <div>
        <p className="mb-3 text-sm font-semibold text-ink">Krok 1 — Ile wynoszą Twoje roczne przychody?</p>
        <div className="flex flex-wrap gap-3">
          {BRACKETS.map(({ label, max }) => {
            const active = bracket === max;
            return (
              <button
                type="button"
                key={label}
                onClick={() => { setBracket(max); setSelectedSuma(50_000); }}
                aria-pressed={active}
                className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-malina ${
                  max === null
                    ? active
                      ? "border-gold bg-gold text-white"
                      : "border-gold/50 bg-gold/5 text-gold hover:bg-gold/10"
                    : active
                      ? "border-malina bg-malina text-white"
                      : "border-malina-soft bg-white text-ink hover:border-malina hover:text-malina"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Powyżej 3M — wycena indywidualna */}
        {bracket === null && (
          <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-6">
            <p className="font-semibold text-ink">Wycena indywidualna</p>
            <p className="mt-1 text-sm text-ink-soft">
              Dla firm o przychodach powyżej 3 000 000 zł program standardowy nie obejmuje oferty online.
              Skontaktuj się z nami — przygotujemy ofertę dopasowaną do Twojej skali działalności.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="tel:+48504400901" className="rounded-full bg-malina px-6 py-2.5 text-sm font-semibold text-white hover:bg-malina-dark">
                Zadzwoń: +48 504 400 901
              </a>
              <a href="mailto:biuro@beautypolisa.pl" className="rounded-full border border-malina px-6 py-2.5 text-sm font-semibold text-malina hover:bg-malina-soft">
                Napisz e-mail
              </a>
            </div>
          </div>
        )}
      </div>

      {/* KROK 2 — SUMA (tylko gdy przychód wybrany i ≤3M) */}
      {bracket !== undefined && bracket !== null && (
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">Krok 2 — Wybierz sumę ubezpieczenia</p>
          <div className="grid gap-4 md:grid-cols-2">
            {SUMY.map((suma) => {
              const w = warianty.find((v) => v.przychod_max === bracket && v.suma_ubezpieczenia === suma);
              const active = selectedSuma === suma;
              return (
                <button
                  type="button"
                  key={suma}
                  onClick={() => setSelectedSuma(suma)}
                  aria-pressed={active}
                  disabled={!w}
                  className={`rounded-2xl border-2 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-malina ${
                    active ? "border-malina bg-white shadow-card" : "border-malina-soft bg-white/70 hover:shadow-soft"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Suma ubezpieczenia</p>
                  <p className="mt-1 text-2xl font-bold">{pln(suma)}</p>
                  <p className="text-sm text-ink-soft">Podlimit grzywien: {pln(suma * 0.75)}</p>
                  {w && (
                    <p className="mt-3 text-xl font-bold text-malina">{pln(w.skladka_roczna)} <span className="text-sm font-normal text-ink-soft">/ rok</span></p>
                  )}
                  <p className="mt-1 text-xs text-ink-soft">Obejmuje 1 spór podatkowy rocznie</p>
                  <span className={`mt-3 inline-block rounded-full px-4 py-1 text-xs font-semibold ${active ? "bg-malina text-white" : "bg-malina-soft text-malina"}`}>
                    {active ? "Wybrana ✓" : "Wybierz"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Potrzebujesz obsługi więcej niż 1 sporu lub wyższej sumy? <a href="tel:+48504400901" className="text-malina underline">Skontaktuj się z nami</a> — przygotujemy wycenę indywidualną.</p>
        </div>
      )}

      {/* FORMULARZ DANYCH — tylko gdy wariant wybrany */}
      {activeWariant && (
        <div id="wniosek" className="scroll-mt-24 rounded-3xl bg-white p-7 shadow-card md:p-10">
          <h3 className="text-2xl font-semibold">Dane do wniosku</h3>
          <p className="mt-1 text-sm text-ink-soft">Trzy minuty — i fiskus przestaje spędzać Ci sen z powiek.</p>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="nip" className="label">NIP</label>
              <div className="flex gap-2">
                <input
                  id="nip" inputMode="numeric" autoComplete="off" placeholder="np. 1234563218"
                  className="field" value={nip}
                  onChange={(e) => { setNip(e.target.value); setGusState("idle"); }}
                />
                <button
                  type="button" onClick={lookupGus} disabled={!nipOk || gusState === "loading"}
                  className="shrink-0 rounded-xl border border-malina px-4 text-sm font-semibold text-malina transition enabled:hover:bg-malina-soft disabled:opacity-40"
                >
                  {gusState === "loading" ? "Szukam…" : "Pobierz z GUS"}
                </button>
              </div>
              {nip && !nipOk && <p className="mt-1.5 text-xs text-malina">Ten NIP wygląda na niepoprawny — sprawdź cyfry.</p>}
              {gusState === "ok" && !gusWarning && <p className="mt-1.5 text-xs text-green-700">✓ Dane pobrane z rejestru REGON — sprawdź, czy się zgadzają.</p>}
              {gusState === "ok" && gusWarning && <p className="mt-1.5 text-xs text-amber-700">{gusWarning}</p>}
              {gusState === "manual" && <p className="mt-1.5 text-xs text-ink-soft">Nie udało się pobrać danych — wpisz nazwę firmy ręcznie.</p>}
            </div>

            <div>
              <label htmlFor="nazwa" className="label">Nazwa działalności</label>
              <input id="nazwa" className="field" placeholder="np. Studio Urody Bella Anna Kowalska" value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
            </div>

            <div>
              <label htmlFor="osoba" className="label">Imię i nazwisko</label>
              <input id="osoba" className="field" autoComplete="name" placeholder="np. Anna Kowalska" value={osoba} onChange={(e) => setOsoba(e.target.value)} />
            </div>

            <div>
              <label htmlFor="email" className="label">E-mail</label>
              <input id="email" type="email" autoComplete="email" className="field" placeholder="anna@twojsalon.pl" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label htmlFor="telefon" className="label">Telefon <span className="font-normal text-ink-soft">(opcjonalnie)</span></label>
              <input id="telefon" type="tel" autoComplete="tel" className="field" placeholder="+48 600 000 000" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-malina-soft/60 px-5 py-4 text-sm">
            <span>
              Suma: <strong>{pln(activeWariant.suma_ubezpieczenia)}</strong>
              {" · "}Podlimit grzywien: <strong>{pln(activeWariant.podlimit_grzywny ?? 0)}</strong>
              {" · "}Przychody: <strong>{pln(bracket!)}</strong>
            </span>
            <span className="text-xl font-bold text-malina">{pln(activeWariant.skladka_roczna)} / rok</span>
          </div>

          <fieldset className="mt-7 space-y-3 text-sm leading-relaxed text-ink-soft">
            <legend className="sr-only">Oświadczenia</legend>
            {[
              { k: "prawdziwosc" as const, req: true, t: "Oświadczam, że podane dane są prawdziwe i kompletne. Wiem, że umowa ubezpieczenia zawierana jest w zaufaniu do złożonych oświadczeń." },
              { k: "postepowania" as const, req: true, t: "Oświadczam, że wobec mnie ani mojej firmy nie toczy się obecnie postępowanie karnoskarbowe, kontrola podatkowa, celno-skarbowa ani spór z ZUS, PIP lub PFRON." },
              { k: "rodo" as const, req: true, t: "Zapoznałam/em się z notą informacyjną RODO Aura Expert sp. z o.o. i wyrażam zgodę na przetwarzanie moich danych w celu obsługi wniosku o ubezpieczenie." },
              { k: "marketing" as const, req: false, t: "Chcę otrzymywać informacje o produktach Beauty Polisa (opcjonalnie)." },
            ].map((z) => (
              <label key={z.k} className="flex cursor-pointer gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-malina" checked={zgody[z.k]} onChange={(e) => setZgody({ ...zgody, [z.k]: e.target.checked })} />
                <span>{z.req && <span className="text-malina">* </span>}{z.t}</span>
              </label>
            ))}
          </fieldset>

          <div className="mt-6 min-h-[70px]" ref={tsRef}>
            {!siteKey && <p className="text-xs text-ink-soft">Weryfikacja Turnstile zostanie włączona po konfiguracji klucza.</p>}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-malina-soft px-4 py-3 text-sm font-medium text-malina-dark">{error}</p>
          )}

          <button type="submit" disabled={sending} className="mt-6 w-full rounded-full bg-malina py-4 text-base font-semibold text-white shadow-card transition hover:bg-malina-dark disabled:opacity-60 md:w-auto md:px-12">
            {sending ? "Wysyłam wniosek…" : "Wyślij wniosek o ubezpieczenie"}
          </button>
          <p className="mt-3 text-xs text-ink-soft">
            Wysłanie wniosku nie jest jeszcze zawarciem umowy — potwierdzimy ochronę i składkę e-mailem.
          </p>
        </div>
      )}
    </form>
  );
}
