import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidNip, cleanNip, roundToThousand } from "@/lib/nip";
import { sendWniosekEmails } from "@/lib/emails";

export const runtime = "edge";

async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production"; // w dev przepuszczamy
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  const data = await res.json();
  return data.success === true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Turnstile
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
    const human = await verifyTurnstile(String(body.turnstileToken ?? ""), ip);
    if (!human) {
      return NextResponse.json({ error: "Weryfikacja antyspamowa nie powiodła się. Odśwież stronę i spróbuj ponownie." }, { status: 400 });
    }

    // 2. Walidacja
    const nip = cleanNip(String(body.nip ?? ""));
    if (!isValidNip(nip)) return NextResponse.json({ error: "Podany NIP jest nieprawidłowy." }, { status: 400 });

    const nazwa = String(body.nazwa_firmy ?? "").trim();
    if (nazwa.length < 3) return NextResponse.json({ error: "Podaj nazwę działalności." }, { status: 400 });

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Podaj prawidłowy adres e-mail." }, { status: 400 });

    const przychod = roundToThousand(Number(body.przychod ?? 0));
    if (!przychod || przychod <= 0) return NextResponse.json({ error: "Podaj wielkość przychodów." }, { status: 400 });
    if (przychod > 3_000_000) {
      return NextResponse.json({ error: "Tax Protect w programie Beauty Polisa jest dostępny dla firm o przychodach do 3 mln zł. Skontaktuj się z nami — przygotujemy ofertę indywidualną." }, { status: 400 });
    }

    if (!body.zgoda_rodo || !body.zgoda_prawdziwosc || !body.oswiadczenie_brak_postepowan) {
      return NextResponse.json({ error: "Zaznacz wymagane oświadczenia." }, { status: 400 });
    }

    const db = supabaseAdmin();

    // 3. Wariant (z bazy — nie ufamy cenie z frontu)
    let wariant: any = null;
    if (body.wariant_id) {
      const { data } = await db.from("tax_warianty").select("*").eq("id", body.wariant_id).eq("aktywny", true).single();
      wariant = data;
    }

    // 4. Zapis wniosku
    const { data: wniosek, error } = await db
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
        oswiadczenie_brak_postepowan: true,
      })
      .select("id")
      .single();

    if (error || !wniosek) {
      console.error("DB insert error", error);
      return NextResponse.json({ error: "Nie udało się zapisać wniosku. Spróbuj ponownie za chwilę." }, { status: 500 });
    }

    // 5. E-maile (klient, Colonnade, broker)
    const sent = await sendWniosekEmails({
      id: wniosek.id,
      nip,
      nazwa_firmy: nazwa,
      email_kontaktowy: email,
      telefon: body.telefon || null,
      osoba_kontaktu: body.osoba_kontaktu || null,
      przychod_roczny: przychod,
      wariant_nazwa: wariant?.nazwa ?? null,
      suma_ubezpieczenia: wariant?.suma_ubezpieczenia ?? null,
      skladka_roczna: wariant?.skladka_roczna ?? null,
    });
    await db.from("tax_wnioski").update({ emaile_wyslane: sent }).eq("id", wniosek.id);

    return NextResponse.json({ ok: true, id: wniosek.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Wystąpił nieoczekiwany błąd." }, { status: 500 });
  }
}
