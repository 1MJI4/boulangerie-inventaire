// Événements que seule la tablette connaît (ex. « inventaire terminé » : la
// clôture se constate à l'écran, rien n'est clos en base). Une clé par jour :
// un double envoi ne notifie qu'une fois.
import { NextResponse } from 'next/server';
import { exigerRole } from '@/lib/auth/garde';
import { dateIsoValide, notifInventaireTermine } from '@/domaine/notifications';
import { notifierManager } from '@/lib/serveur/notifications';

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'prévenir le manager');
  if (!garde.ok) return garde.reponse;
  const corps = (await request.json().catch(() => null)) as { type?: unknown; date?: unknown } | null;
  if (corps?.type !== 'inventaire_termine' || !dateIsoValide(corps.date)) {
    return NextResponse.json({ ok: false, message: 'Événement inconnu.' }, { status: 400 });
  }
  await notifierManager(notifInventaireTermine(corps.date));
  return NextResponse.json({ ok: true });
}
