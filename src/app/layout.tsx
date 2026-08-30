import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import { getTranslations } from "@/lib/i18n/server";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

/**
 * Generated rather than static, so the browser tab is in the same language as
 * the page under it. A hard-coded Turkish title survived the default flipping to
 * English and was the one Turkish string an English session could not get rid of.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getTranslations();
  return {
    title: `Cacao Route · ${dict.brand.panel}`,
    description: dict.brand.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2e5e4e",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getTranslations();

  return (
    <html lang={locale} className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
