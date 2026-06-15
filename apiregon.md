# API REGON (GUS BIR 1.1) — Dokumentacja implementacyjna

Gotowy przewodnik do wielokrotnego użytku. Zawiera pełny kod, strukturę SOAP, parsowanie odpowiedzi i integrację z frontendem.

---

## 1. Informacje podstawowe

| Parametr | Wartość |
|---|---|
| Protokół | SOAP 1.2 (application/soap+xml) |
| Endpoint produkcyjny | `https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc` |
| Endpoint testowy | `https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc` |
| Klucz testowy | `abcde12345abcde12345` |
| Rejestracja kluczy | https://api.stat.gov.pl/Home/RegonApi |
| Namespace główny | `http://CIS/BIR/PUBL/2014/07` |
| Namespace kontraktów | `http://CIS/BIR/PUBL/2014/07/DataContract` |

---

## 2. Zmienne środowiskowe

```env
# .env / .env.local
GUS_API_KEY=twoj_klucz_api_bir11
```

---

## 3. Implementacja — TypeScript / Next.js (Edge Function)

### 3.1 Pełny handler (`app/api/gus/route.ts`)

```typescript
export const runtime = "edge";

const BIR_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const NS = 'xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"';

// Pomocnik: wyślij żądanie SOAP
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

// Pomocnik: wyciągnij wartość tagu z XML
function extract(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nip = searchParams.get("nip")?.replace(/[^0-9]/g, "") ?? "";

  if (nip.length !== 10) {
    return Response.json({ error: "Nieprawidłowy NIP" }, { status: 400 });
  }

  const key = process.env.GUS_API_KEY;
  if (!key) {
    return Response.json({ available: false, reason: "no_key" });
  }

  try {
    // KROK 1: Logowanie — uzyskanie sesji (sid)
    const loginXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj",
      `<ns:Zaloguj><ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika></ns:Zaloguj>`
    );
    const sid = extract(loginXml, "ZalogujResult");
    if (!sid) return Response.json({ found: false });

    // KROK 2: Wyszukanie podmiotu po NIP
    const searchXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty",
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
      sid
    );

    const raw = extract(searchXml, "DaneSzukajPodmiotyResult");
    if (!raw) return Response.json({ found: false });

    // Dekodowanie encji HTML w odpowiedzi XML
    const decoded = raw
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');

    // Wyciągnięcie danych podmiotu
    const nazwa = extract(decoded, "Nazwa");
    const regon = extract(decoded, "Regon");
    const ulica = extract(decoded, "Ulica") ?? "";
    const nrNieruchomosci = extract(decoded, "NrNieruchomosci") ?? "";
    const miejscowosc = extract(decoded, "Miejscowosc") ?? "";
    const kod = extract(decoded, "KodPocztowy") ?? "";
    const datumZawieszenia = extract(decoded, "DataZawieszeniaDzialalnosci");

    const adres = [ulica, nrNieruchomosci].filter(Boolean).join(" ") +
      (miejscowosc ? `, ${kod} ${miejscowosc}` : "");

    if (!nazwa) return Response.json({ found: false });

    return Response.json({
      found: true,
      nazwa,
      regon,
      adres,
      data_zawieszenia: datumZawieszenia || null,
    });
  } catch (err) {
    console.error("GUS API error:", err);
    return Response.json({ found: false, error: "gus_error" }, { status: 500 });
  }
}
```

### 3.2 Wersja jako Supabase Edge Function (`supabase/functions/tax-gus/index.ts`)

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BIR_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const NS = 'xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"';

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

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const nip = url.searchParams.get("nip")?.replace(/[^0-9]/g, "") ?? "";

  if (nip.length !== 10) {
    return new Response(JSON.stringify({ error: "Nieprawidłowy NIP" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("GUS_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ available: false, reason: "no_key" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const loginXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj",
      `<ns:Zaloguj><ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika></ns:Zaloguj>`
    );
    const sid = extract(loginXml, "ZalogujResult");
    if (!sid) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchXml = await soap(
      "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty",
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
      sid
    );

    const raw = extract(searchXml, "DaneSzukajPodmiotyResult");
    if (!raw) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decoded = raw
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    const nazwa = extract(decoded, "Nazwa");
    const regon = extract(decoded, "Regon");
    const ulica = extract(decoded, "Ulica") ?? "";
    const nrNieruchomosci = extract(decoded, "NrNieruchomosci") ?? "";
    const miejscowosc = extract(decoded, "Miejscowosc") ?? "";
    const kod = extract(decoded, "KodPocztowy") ?? "";
    const datumZawieszenia = extract(decoded, "DataZawieszeniaDzialalnosci");
    const adres = [ulica, nrNieruchomosci].filter(Boolean).join(" ") +
      (miejscowosc ? `, ${kod} ${miejscowosc}` : "");

    if (!nazwa) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      found: true, nazwa, regon, adres,
      data_zawieszenia: datumZawieszenia || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ found: false, error: "gus_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 4. Struktura żądań SOAP

### 4.1 Logowanie (`Zaloguj`)

**Żądanie:**
```xml
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:ns="http://CIS/BIR/PUBL/2014/07">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc</wsa:To>
    <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:Zaloguj>
      <ns:pKluczUzytkownika>TWOJ_KLUCZ_API</ns:pKluczUzytkownika>
    </ns:Zaloguj>
  </soap:Body>
</soap:Envelope>
```

**Odpowiedź:**
```xml
<ZalogujResponse>
  <ZalogujResult>XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</ZalogujResult>
</ZalogujResponse>
```
`ZalogujResult` = identyfikator sesji (`sid`), przekazywany w nagłówku HTTP kolejnych żądań.

---

### 4.2 Wyszukiwanie po NIP (`DaneSzukajPodmioty`)

**Żądanie** (nagłówek HTTP: `sid: XXXXXXXX`):
```xml
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:ns="http://CIS/BIR/PUBL/2014/07"
  xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc</wsa:To>
    <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:DaneSzukajPodmioty>
      <ns:pParametryWyszukiwania>
        <dat:Nip>1234563218</dat:Nip>
      </ns:pParametryWyszukiwania>
    </ns:DaneSzukajPodmioty>
  </soap:Body>
</soap:Envelope>
```

**Inne możliwe parametry wyszukiwania** (zamiast `Nip`):
```xml
<dat:Regon>123456789</dat:Regon>
<dat:Krs>0000123456</dat:Krs>
<dat:Nip>1234563218</dat:Nip>
<!-- Można kombinować: Nip + inne filtry -->
```

**Odpowiedź** — `DaneSzukajPodmiotyResult` zawiera zakodowany XML (encje HTML):
```xml
<DaneSzukajPodmiotyResult>
  &lt;root&gt;&lt;dane&gt;
    &lt;Regon&gt;123456789&lt;/Regon&gt;
    &lt;Nip&gt;1234563218&lt;/Nip&gt;
    &lt;Nazwa&gt;STUDIO URODY BELLA ANNA KOWALSKA&lt;/Nazwa&gt;
    &lt;Ulica&gt;ul. Kwiatowa&lt;/Ulica&gt;
    &lt;NrNieruchomosci&gt;12&lt;/NrNieruchomosci&gt;
    &lt;NrLokalu&gt;3&lt;/NrLokalu&gt;
    &lt;Miejscowosc&gt;Warszawa&lt;/Miejscowosc&gt;
    &lt;KodPocztowy&gt;00-001&lt;/KodPocztowy&gt;
    &lt;Poczta&gt;Warszawa&lt;/Poczta&gt;
    &lt;DataZawieszeniaDzialalnosci&gt;&lt;/DataZawieszeniaDzialalnosci&gt;
    &lt;DataWpisurejestruEwidencji&gt;2015-03-01&lt;/DataWpisurejestruEwidencji&gt;
  &lt;/dane&gt;&lt;/root&gt;
</DaneSzukajPodmiotyResult>
```

---

## 5. Dostępne pola w odpowiedzi

| Pole XML | Opis |
|---|---|
| `Regon` | Numer REGON (9 lub 14 cyfr) |
| `Nip` | NIP bez kresek |
| `Nazwa` | Pełna nazwa firmy / imię i nazwisko przedsiębiorcy |
| `Ulica` | Nazwa ulicy (może być pusta dla małych miejscowości) |
| `NrNieruchomosci` | Numer budynku |
| `NrLokalu` | Numer lokalu (opcjonalne) |
| `Miejscowosc` | Miejscowość siedziby |
| `KodPocztowy` | Kod pocztowy (format: `XX-XXX`) |
| `Poczta` | Nazwa poczty |
| `DataZawieszeniaDzialalnosci` | Data zawieszenia (pusta = aktywna) |
| `DataWpisurejestruEwidencji` | Data rejestracji działalności |
| `SilosID` | Typ podmiotu: `1`=JDG, `2`=spółka cywilna, `3`=inne osoby prawne, `4`=spółki, `6`=osoby fizyczne |

---

## 6. Walidacja NIP

```typescript
function cleanNip(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function isValidNip(raw: string): boolean {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]);
}
```

---

## 7. Integracja frontendowa (React)

```typescript
// Stan
const [gusState, setGusState] = useState<"idle" | "loading" | "ok" | "manual">("idle");
const [gusWarning, setGusWarning] = useState<string | null>(null);

// Funkcja wyszukiwania
async function lookupGus() {
  if (!isValidNip(nip)) return;
  setGusState("loading");
  setGusWarning(null);
  try {
    const res = await fetch(`/api/gus?nip=${cleanNip(nip)}`);
    // lub dla Supabase Edge:
    // const res = await fetch(`${SUPABASE_URL}/functions/v1/tax-gus?nip=${cleanNip(nip)}`);
    const data = await res.json();
    if (data.found) {
      setNazwa(data.nazwa ?? "");
      setRegon(data.regon ?? "");
      setAdres(data.adres ?? "");
      setGusWarning(
        data.data_zawieszenia
          ? `⚠️ Według GUS działalność jest zawieszona od ${data.data_zawieszenia}.`
          : null
      );
      setGusState("ok");
    } else {
      setGusState("manual"); // użytkownik wpisuje ręcznie
    }
  } catch {
    setGusState("manual");
  }
}

// JSX
<div className="flex gap-2">
  <input
    value={nip}
    onChange={(e) => { setNip(e.target.value); setGusState("idle"); }}
    placeholder="np. 1234563218"
  />
  <button
    type="button"
    onClick={lookupGus}
    disabled={!isValidNip(nip) || gusState === "loading"}
  >
    {gusState === "loading" ? "Szukam…" : "Pobierz z GUS"}
  </button>
</div>

{gusState === "ok" && !gusWarning && (
  <p>✓ Dane pobrane z rejestru REGON — sprawdź, czy się zgadzają.</p>
)}
{gusState === "ok" && gusWarning && <p>{gusWarning}</p>}
{gusState === "manual" && (
  <p>Nie udało się pobrać danych — wpisz nazwę firmy ręcznie.</p>
)}
```

---

## 8. Odpowiedź JSON z API (format ustandaryzowany)

```json
// Podmiot znaleziony
{
  "found": true,
  "nazwa": "STUDIO URODY BELLA ANNA KOWALSKA",
  "regon": "123456789",
  "adres": "ul. Kwiatowa 12, 00-001 Warszawa",
  "data_zawieszenia": null
}

// Podmiot zawieszony
{
  "found": true,
  "nazwa": "FRYZJER JAN NOWAK",
  "regon": "987654321",
  "adres": "ul. Różana 5, 30-000 Kraków",
  "data_zawieszenia": "2024-01-15"
}

// Nie znaleziono
{
  "found": false
}

// Brak klucza API (graceful fallback)
{
  "available": false,
  "reason": "no_key"
}
```

---

## 9. Obsługa błędów i fallback

| Scenariusz | Zachowanie |
|---|---|
| Brak `GUS_API_KEY` | Zwróć `{ available: false }`, formularz działa ręcznie |
| NIP nieznaleziony w REGON | `{ found: false }`, użytkownik wpisuje dane ręcznie |
| Błąd sieci / timeout GUS | `{ found: false, error: "gus_error" }`, tryb ręczny |
| Działalność zawieszona | `{ found: true, data_zawieszenia: "YYYY-MM-DD" }`, wyświetl ostrzeżenie |
| Nieprawidłowy NIP | `400 { error: "Nieprawidłowy NIP" }` |

---

## 10. Checklist wdrożenia

- [ ] Zarejestrować klucz API na https://api.stat.gov.pl/Home/RegonApi
- [ ] Dodać `GUS_API_KEY` do zmiennych środowiskowych (Vercel / Supabase / .env)
- [ ] Wdrożyć endpoint `/api/gus` lub Supabase Edge Function
- [ ] Podpiąć button "Pobierz z GUS" w formularzu
- [ ] Obsłużyć stany: `idle → loading → ok / manual`
- [ ] Wyświetlić ostrzeżenie gdy `data_zawieszenia !== null`
- [ ] Umożliwić ręczną edycję danych pobranych z GUS (użytkownik może skorygować)
- [ ] Na endpoint testowy używać klucza `abcde12345abcde12345`
