# Sécurité

## Signaler une vulnérabilité

Ne pas ouvrir d'issue publique. Utiliser le signalement privé de GitHub :
onglet **Security** → **Report a vulnerability**.

Une réponse est apportée sous 7 jours.

## Versions supportées

Seule la dernière version publiée de chaque package `@lacolombemons/*` reçoit des correctifs.

## Chaîne de publication

- Les packages sont publiés sur npm uniquement par le workflow `Release` de ce dépôt, via trusted publishing (OIDC),
  après validation manuelle de l'environnement GitHub `npm`. Aucun token npm n'existe.
- Chaque version porte une attestation de provenance npm, vérifiable avec `npm audit signatures`.
