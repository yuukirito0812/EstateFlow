import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EstateFlow | Your real estate workspace",
  description: "A workspace for real estate leads, follow-ups, property matches and AI-assisted communication. Built by Carl Vincent Zabala.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
