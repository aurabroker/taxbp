# Beauty Polisa — Tax Protect (wnioski online)

Aplikacja Next.js 14 do zbierania wniosków o ubezpieczenie ochrony skarbowej i podatkowej
**Tax Protect** (Colonnade) w programie **Beauty Polisa** (Aura Expert).
Przygotowana pod **Cloudflare Pages** (wszystkie trasy dynamiczne na edge runtime).

## Co jest w środku

| Element | Opis |
|---|---|
| `/` | Landing: zakres ochrony (Sekcja 1 + 2 z OWU), FAQ, warianty składek z bazy, formularz wniosku |
| `/admin` | Panel: statystyki, lista wniosków, zmiana statusu, wpisanie numeru polisy |
| `POST /api/wniosek` | Weryfikacja Turnstile → walidacja NIP → zapis do Supabase → 3 e-maile Resend |
| `GET /api/gus?nip=` | Nazwa firmy z GUS (BIR1.1) — aktywuje się po ustawieniu `GUS_API_KEY` |
| Supabase | Projekt **BEAUTY**, tabele `tax_wnioski` i `tax_warianty` (utworzone migracją) |

## Deploy na Cloudflare Pages

1. Wypchnij repo na GitHub/GitLab i w panelu Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Ustawienia builda:
   - **Build command:** `npx @cloudflare/next-on-pages@1`
   - **Build output directory:** `.vercel/output/static`
3. Po pierwszym deployu: **Settings → Functions → Compatibility flags** → dodaj `nodejs_compat`
   (dla Production i Preview), potem ponowny deploy. Bez tej flagi funkcje nie wystartują.
4. Zmienne środowiskowe (patrz niżej) → **Settings → Environment variables**.

Lokalnie: `npm install && npm run dev` (klucze w `.env.local`).
Podgląd builda produkcyjnego: `npm run pages:build && npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat`.

## Zmienne środowiskowe

Pełna lista w `.env.example`. Na Cloudflare Pages wpisuje się je w:
**Workers & Pages → [projekt] → Settings → Environment variables** — wartości wrażliwe
(`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `GUS_API_KEY`,
`ADMIN_PASSWORD`, `ADMIN_SECRET`) zapisuj jako **Secret** (Encrypt). Zmienne `NEXT_PUBLIC_*`
muszą być ustawione **przed buildem** (trafiają do bundla podczas kompilacji).
Po każdej zmianie zmiennych → **Retry deployment / nowy deploy**.

## ⚠️ Do uzupełnienia przed startem

1. **Składki** — `tax_warianty` zawiera 3 warianty PLACEHOLDER (590/890/1290 zł). Potwierdźcie kwoty z Colonnade.
2. **Klucz GUS (BIR1.1)** — produkcyjny, wpisany jako secret `GUS_API_KEY`; lookup włączy się sam.
3. **Domena w Resend** — zweryfikowana domena nadawcy (`RESEND_FROM`), inaczej e-maile nie wyjdą.
4. **Dokumenty PDF** — OWU, karta produktu, RODO: warto podlinkować w stopce po wgraniu na hosting.
