# @lacolombemons/aws-constructs

Constructs AWS CDK partagés par les projets La Colombe Mons. Chaque construct étend la ressource `aws-cdk-lib`
correspondante avec les réglages par défaut repris d'ecodim. Les props passées par le projet restent prioritaires.

## Organisation

Un dossier par service AWS, un fichier par construct :

```
src/
├── index.ts            # export * as <service> from "./<service>"
└── <service>/
    ├── index.ts        # export * from "./<construct>"
    └── <construct>.ts
```

## Ajouter un construct

1. Une branche par construct : `feat/add-<service>-<construct>-construct`.
2. Reprendre le code existant dans ecodim et en extraire les réglages par défaut.
3. Exporter le construct dans `src/<service>/index.ts` et le service dans `src/index.ts`.
4. Après la release, remplacer le code d'ecodim par le construct (bump de version dans ecodim).
