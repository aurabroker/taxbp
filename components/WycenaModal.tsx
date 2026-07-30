"use client";

import { useEffect, useRef, useState } from "react";

const SUPABASE_URL = "https://dhuvykwecsxgchzxufxw.supabase.co";

function cleanNip(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}
function isValidNip(raw: string) {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((a, x, i) => a + x * Number(nip[i]), 0) % 11 === Number(nip[9]);
}

export default function WycenaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nip, setNip] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [osoba, setOsoba] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [wiadomosc, setWiadomosc] = useState("");
  const [zgody, setZgody] = useState({ rodo: false, kanaly: false, marketing: false });
  const [gusState, setGusState] = useState<"idle" | "loading" | "ok" | "manual">("idle");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsRendered = useRef(false);

  const siteKey = process.env.NEXT_PUBLIC_SITE_KEY;
  const nipOk = nip === "" || isValidNip(nip);
  const telOk = cleanNip(telefon).length >= 9;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  // Blokada scrolla tła + zamykanie Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Turnstile
  useEffect(() => {
    if (!open || !siteKey || tsRendered.current) return;
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
  }, [open, siteKey]);

  if (!open) return null;

  async function lookupGus() {
    if (!isValidNip(nip)) return;
    setGusState("loading");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-gus?nip=${cleanNip(nip)}`);
      const data = await res.json();
      if (data.found) {
        setNazwa(data.nazwa ?? "");
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
    if (nazwa.trim().length < 3) return setError("Podaj nazwę działalności.");
    if (!emailOk) return setError("Podaj prawidłowy adres e-mail.");
    if (!telOk) return setError("Telefon jest obowiązkowy — podaj prawidłowy numer.");
    if (!zgody.rodo) return setError("Zaznacz wymaganą zgodę RODO.");
    if (siteKey && !token) return setError("Potwierdź, że nie jesteś robotem.");

    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-wycena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nip: cleanNip(nip),
          nazwa_firmy: nazwa.trim(),
          osoba_kontaktu: osoba.trim(),
          email: email.trim(),
          telefon: telefon.trim(),
          wiadomosc: wiadomosc.trim(),
          zgoda_rodo: zgody.rodo,
          zgoda_kanaly: zgody.kanaly,
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Wycena indywidualna"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative my-8 w-full max-w-lg rounded-3xl border-2 border-malina-line bg-white p-7 shadow-card md:p-9">
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink-soft transition hover:bg-malina-soft hover:text-malina"
        >
          ✕
        </button>

        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-malina-soft text-3xl">💗</div>
            <h3 className="text-2xl font-semibold">Zapytanie wysłane — dziękujemy!</h3>
            <p className="mx-auto mt-3 max-w-sm text-ink-soft">
              Otrzymaliśmy Twoje zapytanie o wycenę indywidualną. Przygotujemy ofertę dopasowaną do Twoich potrzeb i odezwiemy się wkrótce.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-malina px-8 py-3 text-sm font-semibold text-white transition hover:bg-malina-dark"
            >
              Zamknij
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3 className="pr-8 text-2xl font-semibold">Wycena indywidualna</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Dla większej liczby sporów rocznie lub wyższej sumy ubezpieczenia. Wypełnij formularz — przygotujemy ofertę dopasowaną do Ciebie.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="wyc-nip" className="label">NIP <span className="font-normal text-ink-soft">(opcjonalnie)</span></label>
                <div className="flex gap-2">
                  <input
                    id="wyc-nip" inputMode="numeric" autoComplete="off" placeholder="np. 1234563218"
                    className="field" value={nip}
                    onChange={(e) => { setNip(e.target.value); setGusState("idle"); }}
                  />
                  <button
                    type="button" onClick={lookupGus} disabled={!isValidNip(nip) || gusState === "loading"}
                    className="shrink-0 rounded-xl border-2 border-malina px-4 text-sm font-semibold text-malina transition enabled:hover:bg-malina-soft disabled:opacity-40"
                  >
                    {gusState === "loading" ? "Szukam…" : "GUS"}
                  </button>
                </div>
                {nip && !nipOk && <p className="mt-1.5 text-xs text-malina">Ten NIP wygląda na niepoprawny.</p>}
                {gusState === "ok" && <p className="mt-1.5 text-xs text-green-700">✓ Dane pobrane z rejestru REGON.</p>}
              </div>

              <div>
                <label htmlFor="wyc-nazwa" className="label">Nazwa działalności</label>
                <input id="wyc-nazwa" className="field" placeholder="np. Studio Urody Bella" value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
              </div>

              <div>
                <label htmlFor="wyc-osoba" className="label">Imię i nazwisko</label>
                <input id="wyc-osoba" className="field" autoComplete="name" placeholder="np. Anna Kowalska" value={osoba} onChange={(e) => setOsoba(e.target.value)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="wyc-email" className="label">E-mail <span className="text-malina">*</span></label>
                  <input id="wyc-email" type="email" autoComplete="email" className="field" placeholder="anna@twojsalon.pl" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="wyc-tel" className="label">Telefon <span className="text-malina">*</span></label>
                  <input id="wyc-tel" type="tel" autoComplete="tel" className="field" placeholder="+48 600 000 000" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                </div>
              </div>

              <div>
                <label htmlFor="wyc-msg" className="label">Czego potrzebujesz? <span className="font-normal text-ink-soft">(opcjonalnie)</span></label>
                <textarea id="wyc-msg" rows={3} className="field resize-none" placeholder="np. wyższa suma ubezpieczenia, więcej sporów rocznie…" value={wiadomosc} onChange={(e) => setWiadomosc(e.target.value)} />
              </div>
            </div>

            <fieldset className="mt-5 space-y-3 text-sm leading-relaxed text-ink-soft">
              <legend className="sr-only">Zgody</legend>
              {[
                { k: "rodo" as const, req: true, t: "Zapoznałam/em się z notą informacyjną RODO Aura Expert sp. z o.o. i wyrażam zgodę na przetwarzanie moich danych w celu przygotowania oferty." },
                { k: "kanaly" as const, req: false, t: "Wyrażam zgodę na kontakt kanałami elektronicznymi i telefonicznymi: SMS, WhatsApp, komunikatory oraz połączenia telefoniczne (art. 172 Prawa telekomunikacyjnego oraz art. 10 uśude)." },
                { k: "marketing" as const, req: false, t: "Chcę otrzymywać informacje o produktach Beauty Polisa (opcjonalnie)." },
              ].map((z) => (
                <label key={z.k} className="flex cursor-pointer gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-malina" checked={zgody[z.k]} onChange={(e) => setZgody({ ...zgody, [z.k]: e.target.checked })} />
                  <span>{z.req && <span className="text-malina">* </span>}{z.t}</span>
                </label>
              ))}
            </fieldset>

            <div className="mt-5 min-h-[70px]" ref={tsRef}>
              {!siteKey && <p className="text-xs text-ink-soft">Weryfikacja Turnstile zostanie włączona po konfiguracji klucza.</p>}
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-malina-soft px-4 py-3 text-sm font-medium text-malina-dark">{error}</p>
            )}

            <button type="submit" disabled={sending} className="mt-5 w-full rounded-full bg-malina py-4 text-base font-semibold text-white shadow-card transition hover:bg-malina-dark disabled:opacity-60">
              {sending ? "Wysyłam…" : "Wyślij zapytanie o wycenę"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
