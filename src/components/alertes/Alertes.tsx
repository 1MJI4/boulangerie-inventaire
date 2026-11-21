'use client';

// Monte les alertes de l'appareil selon son profil : alarme sonore au comptoir
// (vendeur), notifications système pour le manager.
import { useProfil } from '@/components/ProfilAppareil';
import { AlarmeSalle } from './AlarmeSalle';
import { NotificationsManager } from './NotificationsManager';

export function Alertes() {
  const { profil, prete } = useProfil();
  if (!prete) return null;
  if (profil === 'vendeur') return <AlarmeSalle />;
  if (profil === 'manager') return <NotificationsManager />;
  return null;
}
