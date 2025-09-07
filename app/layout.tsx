
import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Fantacorazzata – Asta Assistant",
  description: "Tool per strategia asta fantacalcio",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
