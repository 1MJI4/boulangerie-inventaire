'use client';

// src/components/alertes/NotificationsManager.tsx
//
// Profil manager : active les notifications sur CET appareil (tablette ou
// téléphone) — nouvelle commande, commande modifiée, inventaire terminé,
// retrait dans 1 h / à l'heure / 2 h après. Notification système : arrive aussi
// application fermée. Sur iPhone et iPad, l'application doit d'abord être
// ajoutée à l'écran d'accueil.

import { useEffect, useState } from 'react';

type Etat = 'inconnu' | 'indisponible' | 'inactif' | 'actif' | 'refuse';

function versOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64);
  const sortie = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
  return sortie;
}

function prisEnCharge(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function NotificationsManager() {
  const [etat, setEtat] = useState<Etat>('inconnu');
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      await Promise.resolve();
      if (!vivant) return;
      if (!prisEnCharge()) return setEtat('indisponible');
      if (Notification.permission === 'denied') return setEtat('refuse');
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const abonne = reg ? await reg.pushManager.getSubscription() : null;
        if (vivant) setEtat(abonne && Notification.permission === 'granted' ? 'actif' : 'inactif');
      } catch {
        if (vivant) setEtat('inactif');
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const activer = async () => {
    setOccupe(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'inactif');
        return;
      }
      const r = await fetch('/api/notifications/abonnement', { cache: 'no-store' });
      const { cle } = (await r.json()) as { cle: string | null };
      if (!cle) {
        setMessage('Les notifications ne sont pas encore réglées sur le serveur. Prévenez la personne qui s’occupe de l’application.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const abonnement =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) }));
      const envoi = await fetch('/api/notifications/abonnement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abonnement: abonnement.toJSON() }),
      });
      if (envoi.status === 403) {
        setMessage('Ouvrez d’abord le profil manager avec le code gérant, puis touchez « Activer » à nouveau.');
        return;
      }
      if (!envoi.ok) {
        setMessage('Cet appareil n’a pas pu être enregistré. Réessayez dans un instant.');
        return;
      }
      setEtat('actif');
    } catch {
      setMessage('Impossible d’activer les notifications sur cet appareil pour le moment.');
    } finally {
      setOccupe(false);
    }
  };

  if (etat === 'inconnu' || etat === 'actif') return null;

  return (
    <div className="fixed bottom-24 right-3 z-40 max-w-xs rounded-2xl bg-surface p-3 text-sm shadow-lg">
      {etat === 'indisponible' ? (
        <p className="text-ink-2">
          Pour recevoir les notifications, ajoutez l’application à l’écran d’accueil (Partager → « Sur l’écran d’accueil »), puis rouvrez-la.
        </p>
      ) : etat === 'refuse' ? (
        <p className="text-ink-2">Les notifications sont bloquées pour cette application : autorisez-les dans les réglages de l’appareil.</p>
      ) : (
        <>
          <p className="mb-2 font-medium text-ink">Recevoir les alertes sur cet appareil ?</p>
          <p className="mb-2 text-ink-2">Commandes, modifications, inventaire terminé, retraits à l’heure et en retard.</p>
          <button
            type="button"
            disabled={occupe}
            onClick={activer}
            className="min-h-11 w-full rounded-xl bg-accent px-4 font-semibold text-accent-texte disabled:opacity-60"
          >
            Activer les notifications
          </button>
        </>
      )}
      {message ? <p className="mt-2 text-bloquant">{message}</p> : null}
    </div>
  );
}
