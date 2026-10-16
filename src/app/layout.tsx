import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "stokio. — Gestion d’inventaire",
  description: "Suivez vos produits, entrées, sorties et alertes de stock en toute simplicité.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
