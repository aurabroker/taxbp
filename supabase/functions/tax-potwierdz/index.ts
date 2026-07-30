import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const pln = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

function emailShell(inner: string): string {
  return `<!doctype html><html lang="pl"><body style="margin:0;background:#FDF4F7;font-family:Arial,Helvetica,sans-serif;color:#222A45;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;">
      <span style="font-size:22px;font-weight:bold;color:#222A45;">Beauty &#10084; Polisa</span>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 4px 24px rgba(34,42,69,0.08);">${inner}</div>
    <p style="font-size:11px;color:#8a90a3;text-align:center;margin-top:20px;line-height:1.5;">
      Beauty Polisa — program ubezpieczeniowy dystrybuowany przez Aura Expert sp. z o.o., agenta ubezpieczeniowego
      wpisanego do rejestru KNF pod nr 11229690/A, działającego na rzecz Colonnade Insurance S.A. Oddział w Polsce.
    </p>
  </div></body></html>`;
}

type WniosekRow = {
  id: string; nip: string; nazwa_firmy: string; email_kontaktowy: string;
  telefon: string | null; osoba_kontaktu: string | null;
  przychod_roczny: number; wariant_id: string | null;
  suma_ubezpieczenia: number | null; skladka_roczna: number | null;
};

function summaryTable(d: WniosekRow, wariantNazwa: string | null): string {
  const row = (l: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">${l}</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #FCE4EC;border-bottom:1px solid #FCE4EC;">
    ${row("Firma", d.nazwa_firmy)}
    ${row("NIP", d.nip)}
    ${row("Przychód roczny", pln(d.przychod_roczny))}
    ${row("Wariant", wariantNazwa ?? "—")}
    ${row("Suma ubezpieczenia", pln(d.suma_ubezpieczenia))}
    ${row("Składka roczna", pln(d.skladka_roczna))}
    ${row("Nr wniosku", d.id.slice(0, 8).toUpperCase())}
  </table>`;
}

type Attachment = { filename: string; content: string };

async function fetchDoc(url: string, filename: string): Promise<Attachment | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { filename, content: btoa(binary) };
  } catch {
    return null;
  }
}

async function documentAttachments(): Promise<Attachment[]> {
  const base = `${Deno.env.get("SUPABASE_URL") ?? ""}/storage/v1/object/public/dokumenty`;
  const docs = [
    { url: Deno.env.get("DOC_OWU_URL") || `${base}/owu.pdf`, filename: "OWU-Tax-Protect.pdf" },
    { url: Deno.env.get("DOC_KARTA_URL") || `${base}/karta-produktu.pdf`, filename: "Karta-produktu-Tax-Protect.pdf" },
  ];
  const results = await Promise.all(docs.map((d) => fetchDoc(d.url, d.filename)));
  return results.filter((x): x is Attachment => x !== null);
}

async function sendEmail(to: string, subject: string, html: string, attachments?: Attachment[]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") || "Beauty Polisa <onboarding@resend.dev>";
  if (!apiKey) return false;
  try {
    const payload: Record<string, unknown> = { from, to, subject, html };
    if (attachments && attachments.length > 0) payload.attachments = attachments;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function page(status: number, title: string, message: string): Response {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Beauty Polisa</title></head>
  <body style="margin:0;background:#FDF4F7;font-family:Arial,Helvetica,sans-serif;color:#222A45;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="max-width:520px;width:100%;background:#fff;border:2px solid #E97BA6;border-radius:24px;padding:40px 32px;text-align:center;box-shadow:0 10px 40px -12px rgba(216,27,96,0.18);">
      <div style="font-size:40px;margin-bottom:8px;">💗</div>
      <h1 style="font-size:24px;margin:0 0 12px;">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#5B6478;margin:0 0 24px;">${message}</p>
      <a href="https://beautypolisa.pl" style="display:inline-block;background:#D81B60;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Wróć na stronę</a>
    </div>
  </body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return page(400, "Brak tokenu", "Link potwierdzający jest niekompletny.");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: w, error } = await supabase
    .from("tax_wnioski")
    .select("id, nip, nazwa_firmy, email_kontaktowy, telefon, osoba_kontaktu, przychod_roczny, wariant_id, suma_ubezpieczenia, skladka_roczna, zweryfikowany")
    .eq("token_weryfikacyjny", token)
    .maybeSingle();

  if (error || !w) return page(404, "Nieprawidłowy link", "Ten link potwierdzający jest nieprawidłowy lub wygasł.");

  if (w.zweryfikowany) {
    return page(200, "Adres już potwierdzony", "Twój wniosek został już potwierdzony i przekazany do obsługi. Dziękujemy!");
  }

  // Oznacz jako zweryfikowany
  await supabase
    .from("tax_wnioski")
    .update({ zweryfikowany: true, data_weryfikacji: new Date().toISOString() })
    .eq("id", w.id);

  // Nazwa wariantu
  let wariantNazwa: string | null = null;
  if (w.wariant_id) {
    const { data: v } = await supabase.from("tax_warianty").select("nazwa").eq("id", w.wariant_id).single();
    wariantNazwa = (v?.nazwa as string) ?? null;
  }

  const row = w as unknown as WniosekRow;
  const sent: Record<string, boolean> = {};
  const attachments = await documentAttachments();

  // 1. Klient — podziękowanie + PDF w załączeniu
  sent.user = await sendEmail(
    row.email_kontaktowy,
    "Dziękujemy za wniosek — Beauty Polisa Tax Protect",
    emailShell(`
      <h1 style="font-size:20px;margin:0 0 12px;">Dziękujemy${row.osoba_kontaktu ? `, ${row.osoba_kontaktu}` : ""}! 💗</h1>
      <p style="font-size:14px;line-height:1.6;">Twój adres e-mail został potwierdzony, a wniosek o ubezpieczenie <strong>Tax Protect</strong> przekazany do obsługi. Skontaktujemy się z Tobą, gdy tylko polisa będzie gotowa — zwykle zajmuje to 1–2 dni robocze.</p>
      ${summaryTable(row, wariantNazwa)}
      ${attachments.length > 0 ? `<p style="font-size:13px;line-height:1.6;color:#5B6478;">W załączniku znajdziesz Ogólne Warunki Ubezpieczenia (OWU) oraz Kartę produktu Tax Protect.</p>` : ""}
      <p style="font-size:13px;line-height:1.6;color:#5B6478;">Masz pytania? Po prostu odpowiedz na tego e-maila.</p>
    `),
    attachments,
  );

  // 2. Aura Expert (broker)
  const emailBroker = Deno.env.get("EMAIL_BROKER");
  if (emailBroker) {
    sent.broker = await sendEmail(
      emailBroker,
      `✅ Wniosek Tax Protect: ${row.nazwa_firmy} — ${pln(row.skladka_roczna)}`,
      emailShell(`
        <h1 style="font-size:18px;margin:0 0 12px;">Klient potwierdził wniosek 🎉</h1>
        ${summaryTable(row, wariantNazwa)}
        <p style="font-size:13px;color:#5B6478;">Kontakt: ${row.email_kontaktowy}${row.telefon ? `, tel. ${row.telefon}` : ""}</p>
      `),
    );
  }

  // 3. Colonnade (ubezpieczyciel)
  const emailColonnade = Deno.env.get("EMAIL_COLONNADE");
  if (emailColonnade) {
    sent.colonnade = await sendEmail(
      emailColonnade,
      `Nowy wniosek Tax Protect — ${row.nazwa_firmy} (NIP ${row.nip})`,
      emailShell(`
        <h1 style="font-size:18px;margin:0 0 12px;">Nowy wniosek Tax Protect (Beauty Polisa)</h1>
        ${summaryTable(row, wariantNazwa)}
        <p style="font-size:13px;color:#5B6478;">Kontakt: ${row.email_kontaktowy}${row.telefon ? `, tel. ${row.telefon}` : ""}</p>
      `),
    );
  }

  await supabase.from("tax_wnioski").update({ emaile_wyslane: sent }).eq("id", w.id);

  return page(
    200,
    "Adres e-mail potwierdzony!",
    "Dziękujemy — Twój wniosek został przyjęty i przekazany do obsługi. Komplet dokumentów (OWU, Karta produktu) wysłaliśmy na Twój adres e-mail.",
  );
});
