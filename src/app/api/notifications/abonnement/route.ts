// Abonnement d'un appareil (tablette, téléphone) aux notifications du manager.
// Réservé au gérant : seul le profil manager reçoit ces notifications.
import { NextResponse } from 'next/server';
import { exigerRole } from '@/lib/auth/garde';
import { abonnementConnu, cleVapidPublique, enregistrerAbonnement, lireAbonnement, retirerAbonnement } from '@/lib/serveur/notifications';

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'activer les notifications');
  if (!garde.ok) return garde.reponse;
  // Avec ?endpoint=… : cet appareil est-il enregistré sur le serveur ? (aucun droit gérant nécessaire)
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  const connu = endpoint && endpoint.length < 1000 ? await abonnementConnu(endpoint) : undefined;
  return NextResponse.json({ cle: cleVapidPublique(), connu }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'recevoir les notifications du manager');
  if (!garde.ok) return garde.reponse;
  const corps = (await request.json().catch(() => null)) as { abonnement?: unknown } | null;
  const abonnement = lireAbonnement(corps?.abonnement);
  if (!abonnement) {
    return NextResponse.json(
      { ok: false, message: 'Cet appareil n’a pas pu être enregistré pour les notifications. Réessayez.' },
      { status: 400 },
    );
  }
  await enregistrerAbonnement(abonnement);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const garde = exigerRole(request, 'gerant', 'arrêter les notifications du manager');
  if (!garde.ok) return garde.reponse;
  const corps = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof corps?.endpoint === 'string') await retirerAbonnement(corps.endpoint);
  return NextResponse.json({ ok: true });
}
