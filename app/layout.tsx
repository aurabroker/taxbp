import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Polisa — Tax Protect | Ubezpieczenie karno-skarbowe dla salonów beauty",
  description:
    "Kontrola z urzędu skarbowego, ZUS lub PIP? Tax Protect chroni Ciebie i Twój salon: opłacamy doradcę podatkowego, prawnika i refundujemy grzywny karnoskarbowe. Wniosek online w 3 minuty.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
