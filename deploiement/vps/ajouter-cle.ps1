# deploiement/vps/ajouter-cle.ps1 — installe la clé SSH du PC sur le VPS (une seule fois).
# Le mot de passe du serveur (e-mail OVH) est tapé par l'utilisateur dans ce
# terminal ; il n'est ni affiché ni enregistré. Si le serveur demande de
# changer le mot de passe à la première connexion, suivre ses questions.
$serveur = 'ubuntu@vps-3490abfa.vps.ovh.net'
$cle = (Get-Content "$env:USERPROFILE\.ssh\pain_azure.pub" -Raw).Trim()
Write-Host "Connexion à $serveur : tapez le mot de passe reçu par e-mail d'OVH (rien ne s'affiche en tapant, c'est normal)."
ssh -t -o StrictHostKeyChecking=accept-new $serveur "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qxF '$cle' ~/.ssh/authorized_keys 2>/dev/null || echo '$cle' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys && echo 'CLE INSTALLEE - vous pouvez fermer cet onglet.'"
