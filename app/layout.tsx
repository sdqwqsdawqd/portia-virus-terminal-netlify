import type { Metadata } from "next";
import "./globals.css";
import "./portia.css";

export const metadata: Metadata = {
  title: "PORTIA — вирусный архив",
  description: "Вымышленный исследовательский терминал PORTIA с редактируемой базой вирусов, информацией и сообщениями станции.",
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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
