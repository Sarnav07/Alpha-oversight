import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Base URL for resolving relative OG/Twitter image paths. Overridable via
// NEXT_PUBLIC_SITE_URL in deploy; falls back to the dev port (4100) so the
// file-convention images still resolve locally.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4100";

// Geist stands in for Aeonik (the AlphaLedger display face) until the licensed
// Aeonik / Aktiv Grotesk webfont is added via next/font/local. Mono = all data.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the /how-it-works "ops" surface ONLY (applied page-scoped via
// [data-surface="ops"] in globals.css). High-contrast editorial serif — a
// deliberate, distinctive counterpoint to the mono data type. Additive: every
// other route keeps Geist and is visually unchanged.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Alpha & Oversight - Command Center",
    template: "%s - Alpha & Oversight",
  },
  description:
    "Adversarial AI trade-surveillance, refereed by a Band of agents. A read-only trace viewer over the Band.",
  applicationName: "Alpha & Oversight",
  keywords: [
    "trade surveillance",
    "adversarial AI",
    "multi-agent",
    "Band of Agents",
    "market abuse",
    "compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "Alpha & Oversight",
    title: "Alpha & Oversight - Command Center",
    description:
      "Adversarial trade-surveillance, refereed by a Band of agents.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alpha & Oversight - Command Center",
    description:
      "Adversarial trade-surveillance, refereed by a Band of agents.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020202",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
