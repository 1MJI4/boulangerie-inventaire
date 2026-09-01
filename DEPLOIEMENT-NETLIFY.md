# Déploiement sur Netlify

## 1. Pousser le code sur GitHub

Netlify déploie depuis un dépôt Git. Vérifiez d'abord que `.env` n'y part pas :

```powershell
git status --short          # .env ne doit PAS apparaître
git add .
git commit -m "Refonte inventaire : dates, sauvegarde, relevés, catégories"
git push
```

## 2. Créer le site

Netlify → **Add new site → Import an existing project** → votre dépôt.

Netlify détecte Next.js et lit `netlify.toml`. Les réglages y sont déjà :

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node | 20 |
| Plugin | `@netlify/plugin-nextjs` |

## 3. Variables d'environnement

**Site configuration → Environment variables.** Sans elles le build passe mais
l'application ne joint pas la base.

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | pooler transaction (port 6543), avec `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | pooler session (port 5432) |
| `CODE_GESTION` | le code du catalogue produits — **changez-le** |
| `NEXTAUTH_SECRET` | la clé aléatoire de votre `.env` |
| `NEXTAUTH_URL` | l'URL du site une fois connue, ex. `https://boulangerie.netlify.app` |

`NEXTAUTH_URL` n'est connue qu'après le premier déploiement : déployez, notez
l'URL, ajoutez la variable, puis relancez un déploiement.

## 4. Vérifier

- `/api/produits` doit renvoyer les 123 produits.
- `/saisie-prevue` doit afficher la viennoiserie.
- Saisir une quantité, recharger : elle doit être là.

---

## Le point de vigilance : la latence

Sur le plan gratuit, Netlify exécute les fonctions à **Ohio (US East)** et cette
région **n'est pas modifiable** — le choix de région est réservé aux plans Pro.

Votre base Supabase est en **Irlande (eu-west-1)**. Chaque requête part donc de
la tablette vers l'Ohio, puis traverse l'Atlantique vers l'Irlande, et revient :
environ 100 ms **par requête base**, plusieurs fois par écran.

Deux façons de s'en sortir :

**Recréer le projet Supabase dans une région US East.** C'est le bon moment :
vous n'avez pas encore de données. Les fonctions et la base se retrouvent alors
côte à côte, et seul le trajet tablette → Ohio reste, une seule fois par
requête au lieu d'une fois par requête SQL. Il suffit de créer un nouveau
projet, de recoller `setup-supabase.sql` et de mettre à jour les deux URL.

**Ou accepter la latence.** L'application est conçue pour : la saisie part en
arrière-plan, l'écran ne bloque jamais, et un brouillon local protège les
frappes. Ce sera lent au chargement d'un écran, pas pendant la saisie.

Le point important : dans la configuration actuelle (Netlify gratuit + Supabase
Irlande), c'est la combinaison la moins bonne des deux mondes.

---

## Limites du plan gratuit

- **300 crédits par mois**, plafond dur : au-delà le site s'arrête jusqu'au mois
  suivant, il n'y a pas de dépassement facturé. Pour quelques tablettes en
  boutique c'est très large, mais surveillez le compteur le premier mois.
- Pas de choix de région (voir ci-dessus).
- Les fonctions ont un démarrage à froid après une période d'inactivité : le
  premier écran ouvert le matin sera plus lent que les suivants.

## En cas d'erreur au déploiement

**« Query Engine not found » ou « rhel-openssl-3.0.x »** — le moteur Prisma pour
Lambda manque. `prisma/schema.prisma` déclare déjà
`binaryTargets = ["native", "rhel-openssl-3.0.x"]` ; si l'erreur persiste,
videz le cache de build (Deploys → Trigger deploy → **Clear cache and deploy**).

**« Can't reach database server »** — les variables d'environnement ne sont pas
définies, ou `DATABASE_URL` pointe sur le port 5432 au lieu de 6543.

**Le build passe mais toutes les pages sont en 500** — regardez
Functions → Logs : c'est presque toujours une variable manquante.
