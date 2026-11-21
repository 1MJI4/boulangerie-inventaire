'use client';

// src/components/alertes/AlarmeSalle.tsx
//
// Tablette du comptoir : alarme sonore forte + bandeau quand une commande
// approche de son échéance (1 h avant) et quand elle est en retard (à l'heure,
// puis 2 h après) — propriétaire, 21/11/2026. Les règles sont celles du
// domaine (`rappelsDus`), les mêmes que les notifications du manager.
// Le bandeau reste jusqu'au toucher « Vu » ; tant qu'un RETARD n'est pas vu,
// l'alarme se répète chaque minute.

import { useEffect, useRef, useState } from 'react';
import { useMaintenant } from '@/components/fiche/useMaintenant';
import { depuisApi, resteAFaire, type Commande, type CommandeApi } from '@/lib/commandes';
import { rappelsDus, sonneEnSalle, type Notification } from '@/domaine/notifications';
import { deverrouillerAudio, jouerAlarme } from './sirene';

const CLE_VUES = 'alarmeSalle:vues';

function lireVues(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE_VUES);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string').slice(-200) : [];
  } catch {
    return [];
  }
}

function ecrireVues(vues: string[]): void {
  try {
    window.localStorage.setItem(CLE_VUES, JSON.stringify(vues.slice(-200)));
  } catch {
    /* stockage indisponible : l'alarme sonnera à nouveau, jamais l'inverse */
  }
}

export function AlarmeSalle() {
  const maintenant = useMaintenant();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [vues, setVues] = useState<string[]>([]);
  const sonnees = useRef<Set<string>>(new Set());

  // Premier toucher : le navigateur autorise le son. Rappels déjà vus : relus.
  useEffect(() => {
    const debloquer = () => deverrouillerAudio();
    window.addEventListener('pointerdown', debloquer, { once: true });
    void Promise.resolve().then(() => setVues(lireVues()));
    return () => window.removeEventListener('pointerdown', debloquer);
  }, []);

  // Commandes à retirer, rafraîchies chaque minute.
  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      try {
        const r = await fetch('/api/commandes?statut=en_cours', { cache: 'no-store' });
        const donnees = (r.ok ? await r.json() : []) as CommandeApi[];
        if (vivant && Array.isArray(donnees)) setCommandes(donnees.map(depuisApi));
      } catch {
        /* réseau faible : on garde la liste d'avant */
      }
    };
    void Promise.resolve().then(charger);
    const minuteur = setInterval(charger, 60_000);
    return () => {
      vivant = false;
      clearInterval(minuteur);
    };
  }, []);

  // Rappels dus et pas encore vus : dérivés de l'heure et des commandes.
  const dus: Notification[] = commandes
    .filter(resteAFaire)
    .flatMap((c) => rappelsDus({ id: c.id, numero: c.numero, retraitLe: c.retraitLe, retraitHeure: c.retraitHeure }, maintenant))
    .filter((n) => sonneEnSalle(n) && !vues.includes(n.cle));
  const cles = dus.map((n) => n.cle).join('|');

  // Un nouveau rappel sonne une fois, tout de suite (une seule alarme même si plusieurs ensemble).
  useEffect(() => {
    const nouveaux = dus.filter((n) => !sonnees.current.has(n.cle));
    if (nouveaux.length === 0) return;
    for (const n of nouveaux) sonnees.current.add(n.cle);
    jouerAlarme(nouveaux.some((n) => n.type !== 'retrait_dans_1h'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cles` résume `dus`
  }, [cles]);

  // Un retard pas encore vu re-sonne chaque minute.
  const enRetard = dus.some((n) => n.type !== 'retrait_dans_1h');
  useEffect(() => {
    if (!enRetard) return;
    const minuteur = setInterval(() => jouerAlarme(true), 60_000);
    return () => clearInterval(minuteur);
  }, [enRetard]);

  if (dus.length === 0) return null;

  const vu = () => {
    const toutes = [...vues, ...dus.map((n) => n.cle)];
    ecrireVues(toutes);
    setVues(toutes);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-3 top-3 z-50 rounded-2xl p-4 shadow-lg ${
        enRetard ? 'bg-bloquant-plein text-bloquant-plein-texte' : 'bg-avertissement text-white'
      }`}
    >
      <ul className="space-y-1">
        {dus.map((n) => (
          <li key={n.cle}>
            <span className="block text-lg font-bold">{n.titre}</span>
            <span className="block text-base">{n.corps}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={vu} className="mt-3 min-h-12 w-full rounded-xl bg-white px-4 text-lg font-semibold text-ink">
        Vu
      </button>
    </div>
  );
}
