import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import "./portia.css";

// Self-hosted at build time; all three carry Cyrillic for the Russian-only audience.
const golos = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-golos", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-unbounded", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "PORTIA — вирусный архив",
  description: "PORTIA OS это операционная система, имеющая в себе база данных вирусов и важной информации.",
  icons: {
    icon: "/assets/portia-virus-icon.png",
    shortcut: "/assets/portia-virus-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
