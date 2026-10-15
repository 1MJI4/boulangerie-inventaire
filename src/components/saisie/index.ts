// Composants de saisie tactile (propriétaire : design-ux).
// Tous les champs chiffrés se saisissent au pavé de l'application, jamais au
// clavier du système. Conversions et validations : `src/domaine/` uniquement.
export { SaisieQuantite, type PropsSaisieQuantite } from './SaisieQuantite';
export { PaveDecimalPoids, type PropsPaveDecimalPoids } from './PaveDecimalPoids';
export { PaveEntier, type PropsPaveEntier } from './PaveEntier';
export { PaveMontant, type PropsPaveMontant } from './PaveMontant';
export { PaveTelephone, type PropsPaveTelephone } from './PaveTelephone';
export { SelecteurDateRetrait, type PropsSelecteurDateRetrait, type EtatJour } from './SelecteurDateRetrait';
export type { ContexteQuantite } from './lecteurs';
export type { PropsCommunesPave } from './CadrePave';
