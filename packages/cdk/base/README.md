# @lacolombemons/cdk-base

`BaseStack`, la stack de base des projets La Colombe Mons.

## Ce qu'elle fait

- **Tags communs** sur toutes les ressources : `Project`, `Stage` (si défini), `ManagedBy=cdk`.
- **Protection contre la suppression** activée par défaut, sauf si `stage` est défini et différent de `prod`.
  `terminationProtection` reste prioritaire s'il est passé explicitement.

## Utilisation

```ts
import { BaseStack, type BaseStackProps } from "@lacolombemons/cdk-base";

export class ApiStack extends BaseStack {
	constructor(scope: Construct, id: string, props: BaseStackProps) {
		super(scope, id, props);
	}
}

new ApiStack(app, "EcodimApiStack", { env, project: "ecodim", stage: "prod" });
```
