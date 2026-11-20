# @lacolombemons/cdk-base

`BaseStack`, la stack de base des projets La Colombe Mons. Inspirée de `@necko-tech/cdk-base`.

## Ce qu'elle fait

- **Tags communs** sur toutes les ressources : `Project`, `Stage` (si défini), `ManagedBy=cdk`.
- **Protection contre la suppression** activée par défaut, sauf si `stage` est défini et différent de `prod`.
  `terminationProtection` reste prioritaire s'il est passé explicitement.
- **Partage de ressources entre stacks via SSM** (`share`, `shareValue`), au lieu des exports CloudFormation.

## Pourquoi SSM plutôt que des exports ?

Quand une stack passe une ressource à une autre (`props.table`), CDK crée un export CloudFormation.
Tant que la stack consommatrice l'utilise, CloudFormation refuse de modifier ou remplacer la ressource
(« Export … cannot be updated as it is in use »), et il faut casser le lien à la main pour avancer.

Avec `share`, la stack productrice écrit les attributs dans des paramètres SSM ; la consommatrice
les lit au déploiement. Le lien est faible : aucun export bloquant.

Les paramètres sont nommés `/cdk/<project>/<stage>/<stackName>/<chemin de la ressource>/<attribut>`.

## Utilisation

```ts
import { BaseStack, type BaseStackProps } from "@lacolombemons/cdk-base";

export class ApiStack extends BaseStack {
	constructor(scope: Construct, id: string, props: BaseStackProps) {
		super(scope, id, props); // props.project = "ecodim", props.stage = "prod"
	}
}
```

- `shareValue(name, value)` publie une chaîne dans SSM et renvoie `(scope, dependency = true) => string`.
- `shareResource(resource, attributes, create)` publie les attributs d'une ressource et renvoie
  `(scope, dependency = true) => IResource`, qui la recrée dans la stack consommatrice avec `create`.
  Depuis la stack productrice, la fonction renvoie directement la valeur ou la ressource.

Aucun type de ressource n'est encore branché : ils seront ajoutés un par un, au fur et à mesure des besoins d'ecodim.

## Limite : même compte, même région

Un paramètre SSM est régional. Producteur et consommateur doivent donc être dans le même compte et la même
région, sinon `share` lève une erreur à la synthèse. Le certificat CloudFront (us-east-1) consommé depuis
eu-west-3 continue donc de passer par `crossRegionReferences`.
