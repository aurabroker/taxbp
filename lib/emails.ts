import { Resend } from "resend";

export type WniosekEmailData = {
  id: string;
  nip: string;
  nazwa_firmy: string;
  email_kontaktowy: string;
  telefon?: string | null;
  osoba_kontaktu?: string | null;
  przychod_roczny: number;
  wariant_nazwa?: string | null;
  suma_ubezpieczenia?: number | null;
  skladka_roczna?: number | null;
};

const pln = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

function shell(inner: string) {
  return `<!doctype html><html lang="pl"><body style="margin:0;background:#FDF4F7;font-family:Arial,Helvetica,sans-serif;color:#222A45;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;">
      <span style="font-size:22px;font-weight:bold;color:#222A45;">Beauty <span style="color:#D81B60;">&#10084;</span> Polisa</span>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 4px 24px rgba(34,42,69,0.08);">${inner}</div>
    <p style="font-size:11px;color:#8a90a3;text-align:center;margin-top:20px;line-height:1.5;">
      Beauty Polisa — program ubezpieczeniowy dystrybuowany przez Aura Expert sp. z o.o., agenta ubezpieczeniowego
      wpisanego do rejestru KNF pod nr 11229690/A, działającego na rzecz Colonnade Insurance S.A. Oddział w Polsce.
      Ubezpieczenie Tax Protect — ochrona skarbowa i podatkowa.
    </p>
  </div></body></html>`;
}

function summaryTable(d: WniosekEmailData) {
  const row = (l: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">${l}</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #FCE4EC;border-bottom:1px solid #FCE4EC;">
    ${row("Firma", d.nazwa_firmy)}
    ${row("NIP", d.nip)}
    ${row("Przychód roczny", pln(d.przychod_roczny))}
    ${row("Wariant", d.wariant_nazwa ?? "—")}
    ${row("Suma ubezpieczenia", pln(d.suma_ubezpieczenia))}
    ${row("Składka roczna", pln(d.skladka_roczna))}
    ${row("Nr wniosku", d.id.slice(0, 8).toUpperCase())}
  </table>`;
}

export async function sendWniosekEmails(d: WniosekEmailData) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || "Beauty Polisa <onboarding@resend.dev>";
  const emailColonnade = process.env.EMAIL_COLONNADE;
  const emailBroker = process.env.EMAIL_BROKER;
  const sent: Record<string, boolean | string> = {};

  // 1. Klient — podziękowanie
  try {
    await resend.emails.send({
      from,
      to: d.email_kontaktowy,
      subject: "Dziękujemy za wniosek — Beauty Polisa Tax Protect",
      html: shell(`
        <h1 style="font-size:20px;margin:0 0 12px;">Dziękujemy${d.osoba_kontaktu ? `, ${d.osoba_kontaktu}` : ""}! 💗</h1>
        <p style="font-size:14px;line-height:1.6;">Otrzymaliśmy Twój wniosek o ubezpieczenie ochrony skarbowej i podatkowej
        <strong>Tax Protect</strong>. Skontaktujemy się z Tobą, gdy tylko polisa będzie gotowa — zwykle zajmuje to 1–2 dni robocze.</p>
        ${summaryTable(d)}
        <p style="font-size:13px;line-height:1.6;color:#5B6478;">Pamiętaj: ochrona obejmuje zdarzenia, które wystąpią po raz pierwszy
        w okresie ubezpieczenia. Obowiązuje karencja 21 dni od zawarcia umowy.</p>
        <p style="font-size:13px;line-height:1.6;color:#5B6478;">Masz pytania? Po prostu odpowiedz na tego e-maila.</p>
      `),
    });
    sent.user = true;
  } catch (e: any) {
    sent.user = `error: ${e?.message ?? e}`;
  }

  // 2. Colonnade / Cellent
  if (emailColonnade) {
    try {
      await resend.emails.send({
        from,
        to: emailColonnade,
        subject: `Nowy wniosek Tax Protect — ${d.nazwa_firmy} (NIP ${d.nip})`,
        html: shell(`
          <h1 style="font-size:18px;margin:0 0 12px;">Nowy wniosek Tax Protect (Beauty Polisa)</h1>
          <p style="font-size:14px;line-height:1.6;">Klient złożył wniosek o ubezpieczenie przez stronę Beauty Polisa.</p>
          ${summaryTable(d)}
          <p style="font-size:13px;color:#5B6478;">Kontakt do klienta: ${d.email_kontaktowy}${d.telefon ? `, tel. ${d.telefon}` : ""}</p>
        `),
      });
      sent.colonnade = true;
    } catch (e: any) {
      sent.colonnade = `error: ${e?.message ?? e}`;
    }
  }

  // 3. Broker (Aura) — powiadomienie wewnętrzne
  if (emailBroker) {
    try {
      await resend.emails.send({
        from,
        to: emailBroker,
        subject: `✅ Wniosek Tax Protect: ${d.nazwa_firmy} — ${pln(d.skladka_roczna)}`,
        html: shell(`
          <h1 style="font-size:18px;margin:0 0 12px;">Klient złożył wniosek 🎉</h1>
          ${summaryTable(d)}
          <p style="font-size:13px;color:#5B6478;">Kontakt: ${d.email_kontaktowy}${d.telefon ? `, tel. ${d.telefon}` : ""}.
          Status możesz zmienić w panelu <strong>/admin</strong>.</p>
        `),
      });
      sent.broker = true;
    } catch (e: any) {
      sent.broker = `error: ${e?.message ?? e}`;
    }
  }

  return sent;
}
