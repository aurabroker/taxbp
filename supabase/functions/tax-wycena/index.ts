import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = Deno.env.get("TSK") ?? Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  return data.success === true;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

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

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") || "Beauty Polisa <onboarding@resend.dev>";
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Nieprawidłowy JSON" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  const human = await verifyTurnstile(String(body.turnstileToken ?? ""), ip);
  if (!human) return respond({ error: "Weryfikacja antyspamowa nie powiodła się. Odśwież stronę i spróbuj ponownie." }, 400);

  const nazwa = String(body.nazwa_firmy ?? "").trim();
  if (nazwa.length < 3) return respond({ error: "Podaj nazwę działalności." }, 400);

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return respond({ error: "Podaj prawidłowy adres e-mail." }, 400);

  const telefon = String(body.telefon ?? "").trim();
  if (telefon.replace(/[^0-9]/g, "").length < 9) return respond({ error: "Podaj prawidłowy numer telefonu." }, 400);

  if (!body.zgoda_rodo) return respond({ error: "Zaznacz wymaganą zgodę RODO." }, 400);

  const osoba = String(body.osoba_kontaktu ?? "").trim();
  const nip = String(body.nip ?? "").replace(/[^0-9]/g, "");
  const wiadomosc = String(body.wiadomosc ?? "").trim();

  const detale = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #FCE4EC;border-bottom:1px solid #FCE4EC;">
      <tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">Firma</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${esc(nazwa)}</td></tr>
      ${nip ? `<tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">NIP</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${esc(nip)}</td></tr>` : ""}
      ${osoba ? `<tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">Osoba</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${esc(osoba)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">E-mail</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${esc(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#5B6478;font-size:13px;">Telefon</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:bold;">${esc(telefon)}</td></tr>
    </table>
    ${wiadomosc ? `<p style="font-size:13px;line-height:1.6;color:#5B6478;"><strong>Wiadomość:</strong><br>${esc(wiadomosc)}</p>` : ""}`;

  const sent: Record<string, boolean> = {};

  // Broker (Aura Expert)
  const emailBroker = Deno.env.get("EMAIL_BROKER");
  if (emailBroker) {
    sent.broker = await sendEmail(
      emailBroker,
      `📝 Zapytanie o wycenę indywidualną Tax Protect — ${nazwa}`,
      emailShell(`
        <h1 style="font-size:18px;margin:0 0 12px;">Zapytanie o wycenę indywidualną</h1>
        <p style="font-size:13px;color:#5B6478;">Klient prosi o wycenę wykraczającą poza standardowy cennik (więcej niż 1 spór rocznie lub wyższa suma ubezpieczenia).</p>
        ${detale}
      `),
    );
  }

  // Potwierdzenie dla klienta
  sent.user = await sendEmail(
    email,
    "Otrzymaliśmy Twoje zapytanie o wycenę — Beauty Polisa Tax Protect",
    emailShell(`
      <h1 style="font-size:20px;margin:0 0 12px;">Dziękujemy${osoba ? `, ${esc(osoba)}` : ""}! 💗</h1>
      <p style="font-size:14px;line-height:1.6;">Otrzymaliśmy Twoje zapytanie o wycenę indywidualną ubezpieczenia <strong>Tax Protect</strong>. Nasz zespół przygotuje ofertę dopasowaną do Twoich potrzeb i skontaktuje się z Tobą.</p>
      ${detale}
    `),
  );

  return respond({ ok: true });
});
