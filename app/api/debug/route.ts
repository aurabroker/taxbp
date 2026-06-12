import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("tax_warianty")
      .select("id, nazwa, aktywny")
      .eq("aktywny", true);
    return NextResponse.json({ ok: true, count: data?.length ?? 0, error: error?.message ?? null, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) });
  }
}
