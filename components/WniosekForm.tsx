"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Wariant = {
  id: string;
  nazwa: string;
  suma_ubezpieczenia: number;
  podlimit_grzywny: number | null;
  skladka_roczna: number;
  opis: string | null;
  kolejnosc: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

function cleanNip(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}
function isValidNip(raw: string) {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((a, x, i) => a + x * Number(nip[i]), 0) % 11 === Number(nip[9]);
}

export default function WniosekForm({ warianty }: { warianty: Wariant[] }) {
  const [wariantId, setWariantId] = useState<string>(warianty[1]?.id ?? warianty[0]?.id ?? "");
  const [nip, setNip] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [regon, setRegon] = useState("");
  const [adres, setAdres] = useState("");
  const [przychod, setPrzychod] = useState("");
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

  // Turnstile
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

  const przychodNum = Number(przychod.replace(/[^\d]/g, "")) || 0;
  const przychodRounded = Math.round(przychodNum / 1000) * 1000;
  const nipOk = isValidNip(nip);

  const wybrany = useMemo(() => warianty.find((w) => w.id === wariantId), [warianty, wariantId]);

  async function lookupGus() {
    if (!nipOk) return;
    setGusState("loading");
    setGusWarning(null);
    try {
      const res = await fetch(`/api/gus?nip=${cleanNip(nip)}`);
      const data = await res.json();
      if (data.found) {
        setNazwa(data.nazwa ?? "");
        setRegon(data.regon ?? "");
        setAdres(data.adres ?? "");
        if (data.pkd) setPkd(data.pkd);
        if (data.data_zawieszenia) {
          setGusWarning(`⚠️ Według GUS działalność jest zawieszona od ${data.data_zawieszenia}. Ubezpieczenie można wystawić po wznowieniu.`);
        } else if (data.pkd_nazwa) {
          setGusWarning(null);
        }
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

    if (!wariantId) return setError("Wybierz wariant ubezpieczenia.");
    if (!nipOk) return setError("Podany NIP jest nieprawidłowy.");
    if (nazwa.trim().length < 3) return setError("Podaj nazwę działalności.");
    if (!przychodRounded) return setError("Podaj wielkość przychodów za ostatni rok.");
    if (przychodRounded > 3_000_000)
      return setError("Program online obejmuje firmy o przychodach do 3 mln zł. Napisz do nas — przygotujemy ofertę indywidualną.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Podaj prawidłowy adres e-mail.");
    if (!zgody.prawdziwosc || !zgody.postepowania || !zgody.rodo) return setError("Zaznacz wymagane oświadczenia.");
    if (siteKey && !token) return setError("Potwierdź, że nie jesteś robotem.");

    setSending(true);
    try {
      const res = await fetch("/api/wniosek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wariant_id: wariantId,
          nip: cleanNip(nip),
          nazwa_firmy: nazwa.trim(),
          regon,
          adres,
          pkd: pkd || undefined,
          przychod: przychodRounded,
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
        <h3 className="font-display text-2xl font-semibold">Wniosek wysłany — dziękujemy!</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Potwierdzenie znajdziesz w swojej skrzynce e-mail. Odezwiemy się, gdy tylko polisa będzie gotowa —
          zwykle w ciągu 1–2 dni roboczych.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-10" noValidate>
      {/* WARIANTY */}
      <div className="grid gap-5 md:grid-cols-3">
        {warianty.map((w, i) => {
          const active = w.id === wariantId;
          return (
            <button
              type="button"
              key={w.id}
              onClick={() => setWariantId(w.id)}
              aria-pressed={active}
              className={`relative rounded-3xl p-7 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-malina ${
                active ? "bg-white shadow-card ring-2 ring-malina" : "bg-white/70 shadow-soft hover:shadow-card"
              }`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-6 rounded-full bg-malina px-3 py-1 text-xs font-bold text-white">
                  Najczęściej wybierany
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{w.nazwa}</p>
              <p className="mt-3 font-display text-3xl font-semibold">
                {pln(w.skladka_roczna)} <span className="text-base font-normal text-ink-soft">/ rok</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                <li>Suma ubezpieczenia: <strong className="text-ink">{pln(w.suma_ubezpieczenia)}</strong></li>
                {w.podlimit_grzywny != null && <li>Limit na grzywny i kary: <strong className="text-ink">{pln(w.podlimit_grzywny)}</strong></li>}
                {w.opis && <li className="pt-1 leading-snug">{w.opis.replace(/\s*\[SKŁADKA DO POTWIERDZENIA\]\s*/, "")}</li>}
              </ul>
              <span className={`mt-5 inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-malina text-white" : "bg-malina-soft text-malina"}`}>
                {active ? "Wybrany ✓" : "Wybierz"}
              </span>
            </button>
          );
        })}
        {warianty.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-sm text-ink-soft md:col-span-3">
            Warianty składek pojawią się tu po konfiguracji (tabela <code>tax_warianty</code>).
          </div>
        )}
      </div>

      {/* FORMULARZ */}
      <div id="wniosek" className="scroll-mt-24 rounded-3xl bg-white p-7 shadow-card md:p-10">
        <h3 className="font-display text-2xl font-semibold">Dane do wniosku</h3>
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
            <label htmlFor="przychod" className="label">Przychód za ostatni zamknięty rok (zł)</label>
            <input
              id="przychod" inputMode="numeric" className="field" placeholder="np. 286 500"
              value={przychod} onChange={(e) => setPrzychod(e.target.value)}
            />
            {przychodNum > 0 && (
              <p className="mt-1.5 text-xs text-ink-soft">
                Do wniosku przyjmiemy: <strong className="text-ink">{pln(przychodRounded)}</strong> (zaokrąglenie do pełnego tysiąca).
              </p>
            )}
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

        {wybrany && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-malina-soft/60 px-5 py-4 text-sm">
            <span>
              Wybrany wariant: <strong>{wybrany.nazwa}</strong> · suma {pln(wybrany.suma_ubezpieczenia)}
            </span>
            <span className="font-display text-xl font-semibold text-malina">{pln(wybrany.skladka_roczna)} / rok</span>
          </div>
        )}

        <fieldset className="mt-7 space-y-3 text-sm leading-relaxed text-ink-soft">
          <legend className="sr-only">Oświadczenia</legend>
          {[
            { k: "prawdziwosc" as const, req: true, t: "Oświadczam, że podane dane są prawdziwe i kompletne. Wiem, że umowa ubezpieczenia zawierana jest w zaufaniu do złożonych oświadczeń." },
            { k: "postepowania" as const, req: true, t: "Oświadczam, że wobec mnie ani mojej firmy nie toczy się obecnie postępowanie karnoskarbowe, kontrola podatkowa, celno-skarbowa ani spór z ZUS, PIP lub PFRON." },
            { k: "rodo" as const, req: true, t: "Zapoznałam/em się z notą informacyjną RODO Aura Expert sp. z o.o. i wyrażam zgodę na przetwarzanie moich danych w celu obsługi wniosku o ubezpieczenie." },
            { k: "marketing" as const, req: false, t: "Chcę otrzymywać informacje o produktach Beauty Polisa (opcjonalnie)." },
          ].map((z) => (
            <label key={z.k} className="flex cursor-pointer gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-malina"
                checked={zgody[z.k]}
                onChange={(e) => setZgody({ ...zgody, [z.k]: e.target.checked })}
              />
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

        <button
          type="submit" disabled={sending}
          className="mt-6 w-full rounded-full bg-malina py-4 text-base font-semibold text-white shadow-card transition hover:bg-malina-dark disabled:opacity-60 md:w-auto md:px-12"
        >
          {sending ? "Wysyłam wniosek…" : "Wyślij wniosek o ubezpieczenie"}
        </button>
        <p className="mt-3 text-xs text-ink-soft">
          Wysłanie wniosku nie jest jeszcze zawarciem umowy — potwierdzimy ochronę i składkę e-mailem.
        </p>
      </div>
    </form>
  );
}
