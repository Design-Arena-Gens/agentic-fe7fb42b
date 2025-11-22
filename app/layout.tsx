import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synthèse PDF intelligente",
  description: "Extraire les points essentiels d'un PDF pour enrichir un chapitre de livre."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
