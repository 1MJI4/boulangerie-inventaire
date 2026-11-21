// Génère la paire de clés VAPID des notifications. À lancer UNE fois, sur le
// serveur ; recopier les trois lignes dans /etc/pain-patisserie/env.
// La clé privée ne se partage ni ne se committe.
import webpush from 'web-push';
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUJET=mailto:ADRESSE-DU-COMMERCE@exemple.be   # à remplacer');
