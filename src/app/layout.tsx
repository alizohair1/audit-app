import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
export const dynamic = "force-dynamic";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Internal Audit App",
  description: "Branch, auditor and admin audit management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} clay-bg min-h-screen font-sans antialiased`}>{children}</body>
    </html>
  );
}
