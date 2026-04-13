import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beacon — Developer Comms Intelligence",
  description: "Real-time developer sentiment monitoring and communications intelligence. 30+ sources, tension detection, engagement velocity, spokesperson prep.",
  openGraph: {
    title: "Beacon — Developer Comms Intelligence",
    description: "Real-time developer sentiment monitoring and communications intelligence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600&family=Inter:wght@400;500&family=Lora:ital,wght@0,400;0,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cream-50 text-ink-900 antialiased">{children}</body>
    </html>
  );
}
