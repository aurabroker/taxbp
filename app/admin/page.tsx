"use client";

import { useEffect, useMemo, useState } from "react";

type Wniosek = {
  id: string;
  created_at: string;
  nip: string;
  nazwa_firmy: string;
  email_kontaktowy: string;
  telefon: string | null;
  przychod_roczny: number;
  suma_ubezpieczenia: number | null;
  skladka_roczna: number | null;
  status: "nowy" | "w_obsludze" | "polisa_wystawiona" | "odrzucony";
  nr_polisy: string | null;
  data_wystawienia: string | null;
  emaile_wyslane: Record<string, unknown>;
};

const pln = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

const STATUS_LABEL: Record<Wniosek["status"], string> = {
  nowy: "Nowy",
  w_obsludze: "W obsłudze",
  polisa_wystawiona: "Polisa wystawiona",
  odrzucony: "Odrzucony",
};
const STATUS_STYLE: Record<Wniosek["status"], string> = {
  nowy: "bg-amber-100 text-amber-800",
  w_obsludze: "bg-blue-100 text-blue-800",
  polisa_wystawiona: "bg-green-100 text-green-800",
  odrzucony: "bg-gray-200 text-gray-600",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [wnioski, setWnioski] = useState<Wniosek[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"wszystkie" | Wniosek["status"]>("wszystkie");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/wnioski");
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setWnioski(data.wnioski ?? []);
    setAuthed(true);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return setLoginError("Nieprawidłowe hasło.");
    setPassword("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setWnioski((w) => w.map((x) => (x.id === id ? { ...x, ...body } : x)));
    await fetch("/api/admin/wnioski", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    load();
  }

  const stats = useMemo(() => {
    const total = wnioski.length;
    const wystawione = wnioski.filter((w) => w.status === "polisa_wystawiona");
    const nowe = wnioski.filter((w) => w.status === "nowy").length;
    const skladki = wystawione.reduce((a, w) => a + (w.skladka_roczna ?? 0), 0);
    return { total, nowe, wystawione: wystawione.length, skladki };
  }, [wnioski]);

  const visible = filter === "wszystkie" ? wnioski : wnioski.filter((w) => w.status === filter);

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-blush px-5">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-card">
          <h1 className="font-display text-2xl font-semibold">Panel Beauty Polisa</h1>
          <p className="mt-1 text-sm text-ink-soft">Tax Protect — wnioski</p>
          <label htmlFor="pwd" className="label mt-6">Hasło</label>
          <input id="pwd" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {loginError && <p className="mt-2 text-sm text-malina">{loginError}</p>}
          <button className="mt-5 w-full rounded-full bg-malina py-3 font-semibold text-white hover:bg-malina-dark">Zaloguj</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-blush px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Wnioski Tax Protect</h1>
            <p className="text-sm text-ink-soft">Beauty Polisa · panel wewnętrzny</p>
          </div>
          <button onClick={load} className="rounded-full border border-ink/15 bg-white px-5 py-2 text-sm font-semibold hover:border-malina hover:text-malina">
            {loading ? "Odświeżam…" : "Odśwież"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Wszystkie wnioski", String(stats.total)],
            ["Nowe (do obsługi)", String(stats.nowe)],
            ["Polisy wystawione", String(stats.wystawione)],
            ["Składki z wystawionych", pln(stats.skladki)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{l}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["wszystkie", "nowy", "w_obsludze", "polisa_wystawiona", "odrzucony"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                filter === f ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"
              }`}
            >
              {f === "wszystkie" ? "Wszystkie" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-soft">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-malina-soft text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Firma / NIP</th>
                <th className="px-4 py-3">Kontakt</th>
                <th className="px-4 py-3 text-right">Przychód</th>
                <th className="px-4 py-3 text-right">Składka</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Nr polisy</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id} className="border-b border-blush last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {new Date(w.created_at).toLocaleDateString("pl-PL")}<br />
                    <span className="text-xs">{new Date(w.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td className="px-4 py-3">
                    <strong>{w.nazwa_firmy}</strong><br />
                    <span className="text-xs text-ink-soft">NIP {w.nip}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {w.email_kontaktowy}<br />
                    <span className="text-xs">{w.telefon ?? ""}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{pln(w.przychod_roczny)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{pln(w.skladka_roczna)}</td>
                  <td className="px-4 py-3">
                    <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[w.status]}`}>
                      {STATUS_LABEL[w.status]}
                    </span>
                    <select
                      aria-label="Zmień status"
                      className="block rounded-lg border border-malina-soft bg-white px-2 py-1 text-xs"
                      value={w.status}
                      onChange={(e) => patch(w.id, { status: e.target.value })}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label="Numer polisy"
                      className="w-36 rounded-lg border border-malina-soft px-2 py-1 text-xs"
                      placeholder="wpisz i Enter"
                      defaultValue={w.nr_polisy ?? ""}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          patch(w.id, { nr_polisy: (e.target as HTMLInputElement).value, status: "polisa_wystawiona" });
                        }
                      }}
                    />
                    {w.data_wystawienia && <p className="mt-1 text-[11px] text-ink-soft">wyst. {w.data_wystawienia}</p>}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">Brak wniosków w tym widoku.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
