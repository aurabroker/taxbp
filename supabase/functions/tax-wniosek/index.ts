import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function cleanNip(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function isValidNip(raw: string): boolean {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((acc, x, i) => acc + x * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]);
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
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

  // Turnstile
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  const human = await verifyTurnstile(String(body.turnstileToken ?? ""), ip);
  if (!human) return respond({ error: "Weryfikacja antyspamowa nie powiodła się. Odśwież stronę i spróbuj ponownie." }, 400);

  // Walidacja
  const nip = cleanNip(String(body.nip ?? ""));
  if (!isValidNip(nip)) return respond({ error: "Podany NIP jest nieprawidłowy." }, 400);

  const nazwa = String(body.nazwa_firmy ?? "").trim();
  if (nazwa.length < 3) return respond({ error: "Podaj nazwę działalności." }, 400);

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return respond({ error: "Podaj prawidłowy adres e-mail." }, 400);

  const przychod = roundToThousand(Number(body.przychod ?? 0));
  if (!przychod || przychod <= 0) return respond({ error: "Podaj wielkość przychodów." }, 400);
  if (przychod > 3_000_000) return respond({ error: "Tax Protect jest dostępny dla firm o przychodach do 3 mln zł." }, 400);

  if (!body.zgoda_rodo || !body.zgoda_prawdziwosc || !body.oswiadczenie_brak_postepowan) {
    return respond({ error: "Zaznacz wymagane oświadczenia." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Wariant z bazy
  let wariant: Record<string, unknown> | null = null;
  if (body.wariant_id) {
    const { data } = await supabase
      .from("tax_warianty")
      .select("*")
      .eq("id", body.wariant_id)
      .eq("aktywny", true)
      .single();
    wariant = data;
  }

  // Zapis wniosku (niezweryfikowany — maile do Aury/Colonnade pójdą dopiero po potwierdzeniu e-maila)
  const { data: wniosek, error } = await supabase
    .from("tax_wnioski")
    .insert({
      nip,
      nazwa_firmy: nazwa,
      regon: body.regon || null,
      adres_siedziby: body.adres || null,
      numer_pkd: body.pkd || null,
      email_kontaktowy: email,
      telefon: body.telefon || null,
      osoba_kontaktu: body.osoba_kontaktu || null,
      przychod_roczny: przychod,
      wariant_id: wariant?.id ?? null,
      suma_ubezpieczenia: wariant?.suma_ubezpieczenia ?? null,
      skladka_roczna: wariant?.skladka_roczna ?? null,
      zgoda_rodo: true,
      zgoda_prawdziwosc: true,
      zgoda_marketing: !!body.zgoda_marketing,
      zgoda_kanaly_kontaktu: !!body.zgoda_kanaly,
      oswiadczenie_brak_postepowan: true,
    })
    .select("id, token_weryfikacyjny")
    .single();

  if (error || !wniosek) {
    console.error("DB insert error", error);
    return respond({ error: "Nie udało się zapisać wniosku. Spróbuj ponownie za chwilę." }, 500);
  }

  // Mail weryfikacyjny (double opt-in) — dopiero po kliknięciu linku wniosek trafi do Aury i Colonnade
  const confirmUrl = `${supabaseUrl}/functions/v1/tax-potwierdz?token=${wniosek.token_weryfikacyjny}`;
  const verSent = await sendEmail(
    email,
    "Potwierdź swój adres e-mail — Beauty Polisa Tax Protect",
    emailShell(`
      <h1 style="font-size:20px;margin:0 0 12px;">Jeszcze jeden krok 💗</h1>
      <p style="font-size:14px;line-height:1.6;">Dziękujemy za wypełnienie wniosku o ubezpieczenie <strong>Tax Protect</strong>. Aby dokończyć jego złożenie, potwierdź swój adres e-mail — kliknij przycisk poniżej.</p>
      <p style="text-align:center;margin:26px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#D81B60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:999px;">Potwierdzam adres e-mail</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#5B6478;">Dopiero po potwierdzeniu przekażemy wniosek do obsługi i prześlemy Ci komplet dokumentów (OWU, Karta produktu). Jeśli to nie Ty wypełniałaś/eś wniosek — po prostu zignoruj tę wiadomość.</p>
      <p style="font-size:12px;line-height:1.6;color:#8a90a3;">Gdyby przycisk nie działał, skopiuj ten link do przeglądarki:<br>${confirmUrl}</p>
    `)
  );

  return respond({ ok: true, pending: true, id: wniosek.id, verificationEmailSent: verSent });
});
