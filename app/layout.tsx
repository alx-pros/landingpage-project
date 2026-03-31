import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-baskerville",
  display: "swap",
});
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeepWave — The Future of Deep Focus",
  description: "A focused workspace for makers, writers, and builders. Launching soon.",
  openGraph: {
    title: "DeepWave — The Future of Deep Focus",
    description: "Reserve your early-access spot before the tide turns.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${cormorantGaramond.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
