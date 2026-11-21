import type { Metadata, Viewport } from 'next';
import { BarreNavigation } from '@/components/BarreNavigation';
import { BarreOnglets } from '@/components/BarreOnglets';
import { GardienProfil } from '@/components/GardienProfil';
import { Alertes } from '@/components/alertes/Alertes';
import { FournisseurProfil } from '@/components/ProfilAppareil';
import { SuiviImpression } from '@/components/SuiviImpression';
import './globals.css';

export const metadata: Metadata = {
  title: 'PAin PAtisserie — Inventaire',
  description: 'Comptage, production et prévisions quotidiennes de la boulangerie.',
  // Nom affiché sous l'icône une fois l'application posée sur l'écran d'accueil.
  applicationName: 'PAin PAtisserie',
  appleWebApp: {
    capable: true,
    title: 'PAin PAtisserie',
    // L'en-tête de l'application passe sous la barre d'état iOS.
    statusBarStyle: 'default',
  },
  // L'application n'a pas vocation à être référencée : c'est un outil interne.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La saisie se fait au doigt : on ne bloque pas le zoom pour autant.
  maximumScale: 5,
  // Couleur de la barre système, adaptée au thème de l'appareil.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <FournisseurProfil>
          <BarreNavigation />
          <main className="mx-auto max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:pt-8">
            <GardienProfil>{children}</GardienProfil>
          </main>
          <BarreOnglets />
          <SuiviImpression />
          <Alertes />
        </FournisseurProfil>
      </body>
    </html>
  );
}
