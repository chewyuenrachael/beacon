import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beacon — Developer Comms Intelligence",
  description:
    "Real-time developer sentiment monitoring and communications intelligence. 30+ sources, tension detection, engagement velocity, spokesperson prep.",
  openGraph: {
    title: "Beacon — Developer Comms Intelligence",
    description:
      "Real-time developer sentiment monitoring and communications intelligence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
