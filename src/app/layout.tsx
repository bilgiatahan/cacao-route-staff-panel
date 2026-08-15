import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import { getLocale } from "@/lib/i18n/server";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cacao Route · Vardiya Paneli",
  description: "Vardiya planlama, izin yönetimi ve bordro paneli.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2e5e4e",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
