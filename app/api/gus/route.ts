import { NextRequest, NextResponse } from "next/server";
import { isValidNip, cleanNip } from "@/lib/nip";

export const runtime = "edge";

/**
 * Wyszukiwanie firmy po NIP w GUS (BIR1.1, SOAP).
 * Gdy GUS_API_KEY nie jest ustawiony, zwraca { available: false } —
 * frontend prosi wtedy o ręczne wpisanie nazwy firmy.
 */
const BIR_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const NS =
  'xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"';

async function soap(action: string, body: string, sid?: string) {
  const res = await fetch(BIR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      ...(sid ? { sid } : {}),
    },
    body: `<soap:Envelope ${NS}><soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing"><wsa:To>${BIR_URL}</wsa:To><wsa:Action>${action}</wsa:Action></soap:Header><soap:Body>${body}</soap:Body></soap:Envelope>`,
  });
  return res.text();
}

function extract(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

export async function GET(req: NextRequest) {
  const nip = cleanNip(req.nextUrl.searchParams.get("nip") ?? "");
  if (!isValidNip(nip)) return NextResponse.json({ error: "Nieprawidłowy NIP" }, { status: 400 });

  const key = process.env.GUS_API_KEY;
  if (!key) return NextResponse.json({ available: false });

  try {
    // 1. Logowanie
    const loginXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj",
      `<ns:Zaloguj><ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika></ns:Zaloguj>`
    );
    const sid = extract(loginXml, "ZalogujResult");
    if (!sid) return NextResponse.json({ available: false });

    // 2. Wyszukanie po NIP
    const searchXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty",
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
      sid
    );
    const raw = extract(searchXml, "DaneSzukajPodmiotyResult");
    if (!raw) return NextResponse.json({ found: false, available: true });

    const decoded = raw
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');

    const nazwa = extract(decoded, "Nazwa");
    if (!nazwa) return NextResponse.json({ found: false, available: true });

    const ulica = extract(decoded, "Ulica") ?? "";
    const nrNieruchomosci = extract(decoded, "NrNieruchomosci") ?? "";
    const miejscowosc = extract(decoded, "Miejscowosc") ?? "";
    const kod = extract(decoded, "KodPocztowy") ?? "";

    return NextResponse.json({
      available: true,
      found: true,
      nazwa,
      regon: extract(decoded, "Regon"),
      adres: [ulica, nrNieruchomosci].filter(Boolean).join(" ") + (miejscowosc ? `, ${kod} ${miejscowosc}` : ""),
    });
  } catch (e) {
    console.error("GUS error", e);
    return NextResponse.json({ available: false });
  }
}
