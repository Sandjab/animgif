# AnimGIF v2 — flou animé (mise au point flou↔net)

**Date** : 2026-07-09
**Statut** : validé (discussion du 2026-07-09)
**Base** : v1 + v2 lot 1 + lot 2a (MP4) + effets oscillatoires/easings en production
(https://sandjab.github.io/animgif/), specs `2026-07-08-animgif-v2-design.md`,
`2026-07-09-animgif-v2-mp4-design.md`, `2026-07-09-animgif-v2-effets-easings-design.md`.

## Objectif

Ajouter un unique effet d'animation **« Mise au point »** : une transition de flou dirigée,
de `fromPx` vers `toPx`, avec easing sélectionnable. Couvre net→flou (`0→8`), flou→net
(`8→0`) et flou→flou. Calqué sur l'effet `rotation` (deux bornes + easing).

Cet effet est le **palier 3** explicitement différé par le spec effets-easings (« Filtres/
couleur animés … demandent un canal opacité/peinture par frame dans la composition
matrice-pure d'aujourd'hui »). Il introduit donc, pour la première fois, un **canal filtre
par frame** à côté du canal matrice existant. C'est le seul écart d'architecture ; il est
contenu à deux sites de rendu.

## Convention structurante (validée)

Les effets existants sont **géométriques** : `effectMatrix` produit une matrice affine
consommée par `ctx.setTransform` + `drawImage`. Le flou n'est **pas** géométrique — c'est un
filtre pixel (`ctx.filter = blur(Xpx)`). Il ne passe donc **pas** par `effectMatrix` ni par la
matrice composée ; il constitue un canal parallèle, calculé par `composeBlur` et posé sur le
contexte au même instant que la matrice, en un **seul** `drawImage`.

`blur` porte un champ `easing` (comme rotation/translation/spin3d, effets « de A à B »), et
**non** une sinusoïde comme les effets oscillatoires — cohérent avec sa nature de transition
dirigée.

## Périmètre

### 1. Nouvel effet `blur`

Variant de type (`src/types.ts`), calqué sur `rotation` :

```ts
| { kind: 'blur'; fromPx: number; toPx: number; easing: Easing }
```

Rayon de flou à l'instant `t` (scalaire, px à la résolution d'export) :

```ts
blur(t) = max(0, lerp(fromPx, toPx, applyEasing(easing, t)))
```

- Défauts UI : `{ fromPx: 0, toPx: 8, easing: 'easeInOut' }` (net→flou, visible d'emblée).
- `fromPx`/`toPx` clampés à `[0, 100]` : un flou négatif n'a pas de sens ; au-delà de 100 px
  le canvas devient coûteux sans gain visuel.

### 2. Canal filtre par frame

**`src/effects/effects.ts`** — `composeEffects` reste **purement géométrique** : elle fait
`continue` sur `kind === 'blur'` (comme elle le fait déjà pour `kenBurns`), donc la présence
d'un effet `blur` **ne déforme jamais** la géométrie. Nouvelle fonction, à côté :

```ts
// Somme des rayons de flou (px) de tous les effets `blur` à l'instant t ; 0 si aucun.
export function composeBlur(effects: Effect[], t: number): number
```

Plusieurs effets `blur` **s'additionnent** (comme des filtres CSS empilés). Le résultat est
clampé ≥ 0.

**`src/frameGenerator.ts`** :
- `computeFrameBlurs(effects, steps): number[]` — `sampleTimes(steps).map(t => composeBlur(...))`,
  jumeau de `computeFrameMatrices` (le flou ne dépend pas de `view`, c'est un px absolu).
- `renderFramesChunked` gagne un paramètre `blurs: number[]` (parallèle à `matrices`). Par
  frame : `ctx.filter` est remis à `'none'` **avant** le `fillRect` du fond (sinon le fond
  bave), puis positionné à `blur(${blurs[i]}px)` (ou `'none'` si 0) **avant** le `drawImage`.

**`src/ui/canvasView.ts`** (`drawFrame`, site de rendu de la preview) : même logique, avec la
mise à l'échelle du §3.

### 3. Cohérence preview↔export (point subtil)

Les matrices s'auto-adaptent à la résolution via `view.outW`/`outH` (preview ≤ 480 px,
export pleine taille). `ctx.filter`, lui, s'applique dans les pixels du canvas courant et ne
s'auto-adapte **pas**.

**Contrat** : `fromPx`/`toPx` sont définis **en px à la résolution d'export** (`outW×outH` du
Store). La preview multiplie le rayon par son facteur d'échelle `s` (le même que
`previewSize`, soit `w / store.outW`) pour rester une représentation fidèle. L'export utilise
le rayon tel quel.

Rappel : le flou statique des Retouches (`Adjustments.blur`) est cuit dans `baked` à la
résolution source puis mis à l'échelle par la matrice → il s'adapte déjà tout seul. Le flou
animé, posé à la volée en espace de sortie, exige cette correction explicite.

### 4. UI

**`src/ui/animPanel.ts`** (calqué sur `rotation`) :
- `defaultEffect` : `case 'blur'` → défauts ci-dessus.
- `TITLES` : `blur: 'Mise au point'` (distinct de « Flou », déjà employé par les Retouches).
- `renderEffectCard` : `case 'blur'` → deux `numberField` (« Flou départ (px) », « Flou
  arrivée (px) ») + `easingField`. Durcissement des entrées comme les effets oscillatoires
  (retour de revue Gemini, PR #2) : `NaN` (champ vidé) → défaut, clamp `[0, 100]`.

**`index.html`** : un `<button data-effect="blur">Mise au point</button>` dans `#effect-buttons`.

### 5. Points de contact (par ajout, tous calqués sur l'existant)

- `src/types.ts` : variant `blur` dans l'union `Effect`.
- `src/effects/effects.ts` : `continue` sur `blur` dans `composeEffects` + nouvelle fonction
  `composeBlur` (+ tests dans `effects.test.ts`).
- `src/frameGenerator.ts` : `computeFrameBlurs` + paramètre `blurs` de `renderFramesChunked`.
- `src/export.ts` : calcule `computeFrameBlurs`, passe `needed.map(i => blurs[i])` en parallèle
  des matrices. **MP4 et GIF inchangés** (ils consomment les `ImageData` déjà rendues, flou
  compris).
- `src/ui/canvasView.ts` : `drawFrame` pose le flou (mis à l'échelle preview).
- `src/ui/animPanel.ts`, `index.html` : voir §4.

## Contraintes

- Seul écart d'architecture : le canal filtre par frame, contenu à `renderFramesChunked` et
  `drawFrame`. `composeEffects` (géométrie), la timeline, la décimation, le pipeline d'export
  GIF **et** MP4 restent inchangés côté encodage.
- Le fond (`fillRect`) ne doit jamais être flouté : `ctx.filter = 'none'` avant de le peindre.
- L'UI ne parle qu'au Store (patch d'effet via `store.update`), motif inchangé.
- Textes UI en français.
- `npm test` et `npm run build` verts à chaque tâche.

## Tests et vérification

- **Unitaires Vitest** (`effects.test.ts`, style des tests existants) :
  - `composeBlur` : `0` sans effet `blur` ; `t=0 → fromPx`, `t=1 → toPx` ; easing respecté à
    `t=0.5` (ex. `easeInOut` → milieu ; un easing non linéaire donne une valeur attendue) ;
    somme de deux effets `blur` ; clamp des valeurs négatives à 0.
  - **Garde de régression** : `composeEffects` (matrice) est **identique** avec et sans un
    effet `blur` dans la liste — encode le *pourquoi* : le flou ne doit jamais déformer la
    géométrie.
- **Vérification navigateur** : ajouter « Mise au point », confirmer en preview la transition
  net→flou et le sens inverse (`8→0`), puis un export GIF **et** un export MP4 intégrant
  l'effet, pour vérifier que le flou par frame est bien présent dans les deux formats et
  cohérent avec la preview.

## Documentation

- README : ajouter « mise au point (flou↔net) » à la liste des effets d'animation.
- `smoke-test.md` : ajouter l'ajout/preview/export d'un effet « Mise au point » (les deux sens,
  GIF + MP4).

## Hors périmètre

- **Autres filtres animés** (hue cycle, fade in/out, strobe, saturation animée) : même canal
  filtre, mais lot dédié une fois « Mise au point » livré et validé.
- **Effets pixel/shader** (glitch, aberration chromatique, CRT, grain, pixelate…) : exigent
  `getImageData` par frame ou WebGL, hors du canal `ctx.filter` — réserve.
- **Unité de flou relative** (fraction de la dimension de sortie plutôt que px absolus) :
  écartée pour rester cohérent avec la convention `numberField` en px des autres effets.
