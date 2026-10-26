# Tarifs sur commande — transcription des deux affiches du gérant

> Ces affiches sont des **sources de données**, au même titre que l'Excel. Elles ne sont pas
> de la documentation. Toute ligne ici doit exister dans le catalogue avec son `regime_prix`.

---

## Affiche 1 — « Sur commande » (traiteur salé) — RÉGIME B

*Liste non-exhaustive.*

| Produit | Prix | Minimum |
|---|---|---|
| Bestella poulet, 10 personnes | 75,00 € | — |
| Bestella fruits de mer, 10 personnes | 90,00 € | — |
| Quiche poulet/saumon, 6 personnes | 27,00 € | — |
| Bestella poulet / fruits de mer, individuelle | 3,90 € | — |
| Mini cêpe farcie classique | 3,20 € | — |
| Mini pizza / quiche | 2,80 € | **10 pièces** |
| Mini wrap | 3,90 € | **10 pièces** |
| Mini burger | 3,50 € | **10 pièces** |
| Mini bestella poulet / fruits de mer | 2,90 € | — |
| Mini briwate poulet / cigare fruits de mer | 2,10 € | — |
| Mini batbout farci | 2,50 € | **10 pièces** |
| Grand pain surprise | 20,00 € | **max 20 sandwichs / pain** |
| Mini-sandwichs garnis | 2,50 €/pièce | **10 pièces** |

**Garnitures des mini-sandwichs** (liste fermée) : Fromage–saumon · Thon piquant ·
Thon mayonnaise · Poulet andalouse · Poulet piquant · Poulet curry · Américain préparé ·
Crabe/surimi · Crevettes à l'ail · Club dinde–fromage

Pied d'affiche : « Autre demande ? Merci de contacter le gérant » → **ligne libre obligatoire**.

Minimum de 10 pièces : s'applique **par ligne de produit**, pas au total du panier
(hypothèse — à confirmer, cf. `QUESTIONS-GERANT.md`).

---

## Affiche 2 — « Tarifs (minimum) pour les Gâteaux SIMPLES sur commande » — RÉGIME C

*« Liste non-exhaustive, ne pas se limiter à celle-ci » — une ligne libre est obligatoire,
pas optionnelle.*
*« Les gâteaux du comptoir restent au prix connu » — le régime A reste séparé.*

> ⚠️ L'affiche porte « Attention : Supplément pour les gâteaux dont le minimum n'est pas
> respecté ». **Cette mention ne s'applique plus** : décision du gérant du 15/10/2026, un
> minimum non atteint est refusé, sans supplément possible (LOI N°7).
> **L'affiche gagnerait à être corrigée** pour ne pas promettre au client une possibilité que
> l'application refuse — un employé pris entre une affiche et un écran qui se contredisent
> finit par contourner l'écran.

### Prix par personne (plancher, « à partir de »)

| Produit | Plancher | Minimum de parts | Variantes |
|---|---|---|---|
| Cake nature | 2,90 €/pers | — | Vanille, Chocolat |
| Crème fraîche | 4,20 €/pers | — | — |
| Bavarois | 4,50 €/pers | — | Chocolat classique, forêt noire, etc. · Fraise, framboise, mangue, passion |
| Layer Cake | 5,00 €/pers | **20 parts** | — |
| Number Cake | 5,00 €/pers | **15 parts PAR SYMBOLE** | — |
| Gâteau de mariage | 5,60 €/pers | **40 parts** (2 étages) | — |
| Pièce montée | 5,60 €/pers | **60 parts** (3 étages) | — |
| Entremet | 6,90 €/pers | — | Chocolat noisette, praliné amande · Framboise avec insert, mangue avec insert |

### Mini-pâtisseries (plancher à la pièce)

| Produit | Plancher | Minimum | Variantes |
|---|---|---|---|
| Mini tartelette | 1,90 € | **15 pièces** | Fraise, framboise |
| Mini bavarois | 2,50 € | **15 pièces** | Chocolat classique, forêt noire, etc. · Framboise, mangue, passion |
| Mini éclair / mille-feuille | 1,50 € | **15 pièces** | Chocolat, moka · Vanille, chocolat, praliné, moka |

### Suppléments

| Supplément | Prix | Base |
|---|---|---|
| Photo | 15,00 € | une fois par gâteau |
| Écriture simple | 2,00 € | une fois par gâteau |
| Pâte à sucre | 6,00 €/pers | **par personne** — décision du propriétaire 26/10/2026 |

Photo et Écriture : cohérents avec le catalogue CSV (catégorie « Gâteaux et tartes ») —
**à revérifier à chaque import de tarif**. La Pâte à sucre n'existe pas au comptoir.

Photo et Écriture s'ajoutent **une fois par gâteau**, jamais par personne.
`40 parts × 5,60 € + photo = 224,00 € + 15,00 € = 239,00 €`, et surtout pas `+ 600,00 €`.

**Pâte à sucre** (décision du propriétaire du 26/10/2026, en vigueur le 26/10/2026) : ce
n'est pas un gâteau, c'est un supplément qui s'ajoute à un gâteau (Layer Cake ou gâteau
carré/rectangle), compté **par personne**, comme les parts du gâteau. Prix fixe (pas un
plancher). Minimum 20 parts. `20 parts × 5,00 € + 20 × 6,00 € = 100,00 € + 120,00 € = 220,00 €`.
Données : `data/tarifs-sur-commande_2026-10-26.json`, clé
`gateaux-sur-commande/supplement-pate-a-sucre`.

Pied d'affiche : « En cas de demande plus spécifique, contacter le pâtissier ou le gérant. »

---

## Points de vigilance connus

1. **« Bastella » (Excel) vs « Bestella » (affiche)** — orthographe à trancher, ne pas
   corriger unilatéralement (LOI N°5).
2. **Quiche 6P** : 27,00 € dans les deux sources ✓
3. **Bastella individuelle** : 3,90 € dans les deux sources ✓
4. **Mini-Burger** : 3,50 € dans les deux sources ✓
5. **Bavarois 8P comptoir = 36,00 €** et **8 × 4,50 € = 36,00 €** en régime C : les montants
   se rejoignent par coïncidence. **Les régimes restent séparés dans les données.**
