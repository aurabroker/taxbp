import { NextRequest, NextResponse } from "next/server";
import { isValidNip, cleanNip } from "@/lib/nip";

export const runtime = "edge";

// BIR1.1 production / BIR1.2 uses the same endpoint, version selected by action namespace
const BIR_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";

const NS = [
  'xmlns:soap="http://www.w3.org/2003/05/soap-envelope"',
  'xmlns:ns="http://CIS/BIR/PUBL/2014/07"',
  'xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"',
].join(" ");

async function soap(action: string, body: string, sid?: string): Promise<string> {
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

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Typ from DaneSzukajPodmioty → raport name for DanePobierzPelnyRaport
const RAPORT_MAP: Record<string, string> = {
  "P": "BIR11OsPrawna",                          // spółki, fundacje, stowarzyszenia
  "F": "BIR11OsFizycznaDzialalnoscCeidg",         // JDG (CEIDG)
  "LP": "BIR11OsPrawnaPubl",                      // jednostki publiczne
  "LF": "BIR11OsFizycznaDzialalnoscOPD",          // inne osoby fizyczne
  "LS": "BIR11OsPrawnaPubl",                      // spółki cywilne
};

async function login(key: string): Promise<string | null> {
  const xml = await soap(
    "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj",
    `<ns:Zaloguj><ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika></ns:Zaloguj>`
  );
  return extract(xml, "ZalogujResult");
}

async function logout(sid: string): Promise<void> {
  await soap(
    "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Wyloguj",
    `<ns:Wyloguj><ns:pIdentyfikatorSesji>${sid}</ns:pIdentyfikatorSesji></ns:Wyloguj>`,
    sid
  ).catch(() => {});
}

async function szukajPodmioty(nip: string, sid: string): Promise<string | null> {
  const xml = await soap(
    "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty",
    `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
    sid
  );
  const raw = extract(xml, "DaneSzukajPodmiotyResult");
  return raw ? decodeEntities(raw) : null;
}

async function pelnyRaport(regon: string, raport: string, sid: string): Promise<string | null> {
  const xml = await soap(
    "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DanePobierzPelnyRaport",
    `<ns:DanePobierzPelnyRaport><ns:pRegon>${regon}</ns:pRegon><ns:pNazwaRaportu>${raport}</ns:pNazwaRaportu></ns:DanePobierzPelnyRaport>`,
    sid
  );
  const raw = extract(xml, "DanePobierzPelnyRaportResult");
  return raw ? decodeEntities(raw) : null;
}

function buildAdres(d: string): string {
  const ulica = extract(d, "Ulica") ?? extract(d, "praw_adSiedzUlica") ?? "";
  const nr = extract(d, "NrNieruchomosci") ?? extract(d, "praw_adSiedzNrNieruchomosci") ?? "";
  const lokal = extract(d, "NrLokalu") ?? extract(d, "praw_adSiedzNrLokalu") ?? "";
  const miasto = extract(d, "Miejscowosc") ?? extract(d, "praw_adSiedzMiejscowosc") ?? "";
  const kod = extract(d, "KodPocztowy") ?? extract(d, "praw_adSiedzKodPocztowy") ?? "";

  const street = [ulica, nr, lokal ? `/${lokal}` : ""].filter(Boolean).join(" ").replace(" /", "/");
  return [street, [kod, miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export async function GET(req: NextRequest) {
  const nip = cleanNip(req.nextUrl.searchParams.get("nip") ?? "");
  if (!isValidNip(nip)) return NextResponse.json({ error: "Nieprawidłowy NIP" }, { status: 400 });

  const key = process.env.GUS_API_KEY;
  if (!key) return NextResponse.json({ available: false });

  let sid: string | null = null;

  try {
    sid = await login(key);
    if (!sid) return NextResponse.json({ available: false });

    const podstawowe = await szukajPodmioty(nip, sid);
    if (!podstawowe) return NextResponse.json({ available: true, found: false });

    const nazwa = extract(podstawowe, "Nazwa");
    if (!nazwa) return NextResponse.json({ available: true, found: false });

    const regon = extract(podstawowe, "Regon") ?? "";
    const typ = extract(podstawowe, "Typ") ?? "F";
    const statusNip = extract(podstawowe, "StatusNip") ?? "";

    // Adres z podstawowych danych (fallback)
    const adresPodstawowy = buildAdres(podstawowe);

    // Pełny raport — dodatkowe pola
    let pkd: string | null = null;
    let pkdNazwa: string | null = null;
    let formaRawna: string | null = null;
    let adresPelny = adresPodstawowy;
    let dataRozpoczecia: string | null = null;
    let dataZawieszenia: string | null = null;

    const raportNazwa = RAPORT_MAP[typ] ?? (typ === "F" ? "BIR11OsFizycznaDzialalnoscCeidg" : "BIR11OsPrawna");

    try {
      const pelneDane = await pelnyRaport(regon, raportNazwa, sid);
      if (pelneDane) {
        // PKD — różne tagi w zależności od typu podmiotu
        pkd =
          extract(pelneDane, "fiz_DzialalnoscGlowna_pkdKod") ??
          extract(pelneDane, "praw_pkdKod") ??
          extract(pelneDane, "pkdKod") ??
          null;
        pkdNazwa =
          extract(pelneDane, "fiz_DzialalnoscGlowna_pkdNazwa") ??
          extract(pelneDane, "praw_pkdNazwa") ??
          extract(pelneDane, "pkdNazwa") ??
          null;
        formaRawna =
          extract(pelneDane, "praw_formaFinansowania_Nazwa") ??
          extract(pelneDane, "fiz_formaFinansowania_Nazwa") ??
          extract(pelneDane, "formaFinansowania_Nazwa") ??
          null;
        dataRozpoczecia =
          extract(pelneDane, "fiz_dataRozpoczeciaDzialalnosci") ??
          extract(pelneDane, "praw_dataRozpoczeciaDzialalnosci") ??
          null;
        dataZawieszenia =
          extract(pelneDane, "fiz_dataZawieszeniaDzialalnosci") ??
          extract(pelneDane, "praw_dataZawieszeniaDzialalnosci") ??
          null;

        const adresZPelnego = buildAdres(pelneDane);
        if (adresZPelnego) adresPelny = adresZPelnego;
      }
    } catch {
      // pełny raport opcjonalny — kontynuujemy z podstawowymi danymi
    }

    return NextResponse.json({
      available: true,
      found: true,
      nazwa,
      regon: regon || null,
      nip,
      adres: adresPelny || adresPodstawowy || null,
      typ,
      pkd: pkd || null,
      pkd_nazwa: pkdNazwa || null,
      forma_prawna: formaRawna || null,
      data_rozpoczecia: dataRozpoczecia || null,
      data_zawieszenia: dataZawieszenia || null,
      status_nip: statusNip || null,
      aktywna: !dataZawieszenia,
    });
  } catch (e) {
    console.error("GUS BIR error", e);
    return NextResponse.json({ available: false });
  } finally {
    if (sid) await logout(sid);
  }
}
