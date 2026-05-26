import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevxAI Delivery Exception Agent",
  description:
    "A Wayfair supply-chain agent for delivery exception triage, rescheduling, and customer communication drafts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
