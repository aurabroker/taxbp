import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, ADMIN_COOKIE } from "@/lib/adminAuth";

export const runtime = "edge";

async function authorized(req: NextRequest) {
  return verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("tax_wnioski")
    .select("id, created_at, nip, nazwa_firmy, email_kontaktowy, telefon, przychod_roczny, suma_ubezpieczenia, skladka_roczna, status, nr_polisy, data_wystawienia, emaile_wyslane")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wnioski: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  const { id, status, nr_polisy } = await req.json();
  if (!id) return NextResponse.json({ error: "Brak id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (status) {
    if (!["nowy", "w_obsludze", "polisa_wystawiona", "odrzucony"].includes(status)) {
      return NextResponse.json({ error: "Nieprawidłowy status" }, { status: 400 });
    }
    patch.status = status;
    patch.data_wystawienia = status === "polisa_wystawiona" ? new Date().toISOString().slice(0, 10) : null;
  }
  if (nr_polisy !== undefined) patch.nr_polisy = nr_polisy || null;

  const db = supabaseAdmin();
  const { error } = await db.from("tax_wnioski").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
