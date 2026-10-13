import type { Metadata } from "next";
import { Golos_Text, IBM_Plex_Serif, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import "./portia.css";

// Self-hosted at build time; all four carry Cyrillic for the Russian-only audience.
const golos = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-golos", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-unbounded", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-jetbrains", display: "swap" });
// Weights 400/600/700: the editor offers 400/600/800 and Plex Serif tops out at 700. No italic: rich text has none.
const plexSerif = IBM_Plex_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"], variable: "--font-plex-serif", display: "swap" });

export const metadata: Metadata = {
  title: "PORTIA — вирусный архив",
  description: "PORTIA OS это операционная система, имеющая в себе база данных вирусов и важной информации.",
  icons: {
    icon: "/assets/portia-virus-icon.png",
    shortcut: "/assets/portia-virus-icon.png",
  },
  // The site is already dark; this tells Dark Reader to leave it alone instead of rewriting the HTML.
  // Content must be non-empty: Next drops metas with empty content, so "" never rendered.
  other: { "darkreader-lock": "true" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable} ${jetbrains.variable} ${plexSerif.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
