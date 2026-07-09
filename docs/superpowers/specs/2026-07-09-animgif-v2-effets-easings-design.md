# AnimGIF v2 — effets oscillatoires + easings

**Date** : 2026-07-09
**Statut** : validé (discussion du 2026-07-09)
**Base** : v1 + v2 lot 1 + lot 2a (MP4) en production (https://sandjab.github.io/animgif/),
specs `2026-07-08-animgif-v2-design.md` et `2026-07-09-animgif-v2-mp4-design.md`.

## Objectif

Enrichir la palette d'animation sans toucher à l'architecture. Deux ajouts, choisis
pour leur rapport effet/effort maximal parce qu'ils réutilisent l'infrastructure exacte
déjà en place :

1. **Trois effets oscillatoires** — `pulse`, `shake`, `sway` — chacun exprimé comme une
   matrice affine 2D interpolée sur `t ∈ [0,1]`, calqués sur `bounce`.
2. **Trois easings** — `easeIn`, `easeOut`, `elastic` — qui enrichissent d'un coup les
   quatre effets « de A à B » existants.

Aucun nouveau mécanisme de rendu : les effets restent des matrices consommées par
`ctx.setTransform` + `drawImage` dans `renderFramesChunked` (inchangé). Les effets pixel
(glitch, aberration chromatique, grain, CRT…) et les filtres animés sont explicitement
hors périmètre (voir *Hors périmètre*).

## Convention structurante (validée)

Les easings n'agissent **que** sur les effets « de A à B » (kenBurns, rotation, translation,
spin3d), dont la progression passe par `applyEasing(effect.easing, t)`. Les effets
**oscillatoires** (bounce et les trois nouveaux) portent leur propre courbe — le `sin` — et
n'ont **pas** de champ `easing`. C'est la convention déjà en place pour `bounce` ; on la
respecte plutôt que de l'étendre.

## Périmètre

### 1. Trois nouveaux effets oscillatoires

Chaque effet suit la forme de `bounce` : deux champs (`amplitude`, `oscillations`), pas de
champ `easing`, retour à l'état neutre en `t=0` et `t=1` avec des valeurs entières
d'`oscillations` (boucle sans couture, au même titre que `bounce`). Ils se composent
par-dessus la matrice de base (fit ou kenBurns) via le chemin `multiply(...)` existant de
`composeEffects` — aucune modification de `composeEffects`.

Notations : `cx = view.outW / 2`, `cy = view.outH / 2`, `A = amplitude`, `k = oscillations`.

| Effet | Variant de type | Matrice à l'instant `t` | Défauts UI |
|---|---|---|---|
| **Pulse** (battement) | `{ kind:'pulse'; amplitude:number; oscillations:number }` | `scaling(s, s, cx, cy)` avec `s = 1 + (A/100)·\|sin(π·k·t)\|` | 15 (%), 2 |
| **Shake** (secousse) | `{ kind:'shake'; amplitude:number; oscillations:number }` | `translation(A·sin(2π·k·t), A·sin(2π·(k+1)·t))` | 8 (px), 6 |
| **Sway** (balancement) | `{ kind:'sway'; amplitude:number; oscillations:number }` | `rotationDeg(A·sin(2π·k·t), cx, view.outH)` | 10 (°), 2 |

Justifications :
- **Pulse** : échelle uniforme oscillante autour du centre de sortie. `|sin(π·k·t)|`
  vaut 0 aux bornes et culmine au milieu de chaque oscillation → l'image « respire »
  depuis sa taille neutre sans jamais rétrécir sous 1. `amplitude` en **pourcentage**
  (15 → +15 % au pic). Réutilise `scaling` (déjà utilisé par spin3d).
- **Shake** : jitter de translation. Les fréquences **différentes** en x et y
  (`k` et `k+1`) produisent une trajectoire de Lissajous d'aspect « tremblé » plutôt
  qu'un simple va-et-vient diagonal. Les deux composantes valent 0 en `t=0` et `t=1`
  (pour `k` entier) → boucle propre. `amplitude` en **px**.
- **Sway** : rotation pendulaire. Le pivot est le **bas** du viewport (`cy = view.outH`)
  et non le centre, pour l'effet « suspendu / drapeau » plutôt qu'une rotation sur place.
  `rotationDeg` accepte déjà un centre arbitraire. `amplitude` en **degrés**.

### 2. Trois nouveaux easings

Ajoutés au type `Easing`, à `applyEasing`, et au menu `EASINGS` de l'UI. Tous respectent
le contrat `f(0)=0, f(1)=1` (déjà vérifié par un test paramétré existant).

| Valeur | Libellé UI | Formule |
|---|---|---|
| `easeIn` | « Ease in » | `t²` |
| `easeOut` | « Ease out » | `t·(2 − t)` |
| `elastic` | « Élastique » | easeOutElastic : `t===0 ? 0 : t===1 ? 1 : 2^(−10t)·sin((10t − 0.75)·(2π/3)) + 1` |

`elastic` dépasse 1 puis se pose (comportement ressort), analogue au dépassement déjà
assumé de `bounce` (= easeOutBack). Il complète la palette : `bounce` anticipe/dépasse en
douceur, `elastic` oscille avant de se stabiliser.

### 3. Points de contact (par ajout, tous calqués sur l'existant)

**Par effet** (×3) :
- `src/types.ts` : nouveau variant dans l'union `Effect`.
- `src/effects/effects.ts` : nouvelle branche dans `effectMatrix` (+ tests dans
  `effects.test.ts`).
- `src/ui/animPanel.ts` : entrée dans `defaultEffect`, dans `TITLES`, et un `case` dans
  `renderEffectCard` (deux `numberField`, sans `easingField`, comme `bounce`).
- `index.html` : un `<button data-effect="…">` dans `#effect-buttons`.

**Par easing** (×3) :
- `src/types.ts` : extension de l'union `Easing`.
- `src/effects/easing.ts` : nouvelle branche dans `applyEasing` (+ couverture dans
  `easing.test.ts`, dont l'itération de préservation des bornes).
- `src/ui/animPanel.ts` : entrée dans le tableau `EASINGS`.

## Contraintes

- Aucun changement d'architecture : `composeEffects`, `renderFramesChunked`, le pipeline
  d'export (GIF et MP4), la timeline et la décimation restent inchangés et testés.
- L'UI ne parle qu'au Store (patch d'effet via `store.update`), motif inchangé.
- Textes UI en français.
- `npm test` et `npm run build` verts à chaque tâche.

## Tests et vérification

- **Unitaires Vitest** :
  - `effects.test.ts` : pour chaque nouvel effet, neutralité en `t=0` (matrice ≈ identité
    autour du repère de l'effet), pic attendu au quart d'oscillation, et retour à l'état
    neutre en `t=1` (valeurs d'`oscillations` entières). Suivre le style des tests `bounce`.
  - `easing.test.ts` : les nouveaux easings entrent dans l'itération de préservation des
    bornes ; plus une assertion de caractère par easing (easeIn démarre sous la diagonale,
    easeOut au-dessus, elastic dépasse 1 avant de se poser).
- **Vérification navigateur** (comme pour chaque effet v2) : ajouter chaque effet depuis
  l'UI, confirmer l'aspect en preview et la boucle sans couture, puis un export GIF et un
  export MP4 qui intègrent au moins un nouvel effet et un nouvel easing.

## Documentation

- README : compléter la liste des effets d'animation (pulse, shake, sway) et des easings.
- `smoke-test.md` : ajouter l'ajout/preview/export d'un effet oscillatoire et le choix d'un
  nouvel easing sur un effet « de A à B ».

## Hors périmètre

- **Effets pixel/shader** (palier 4 de la discussion) : aberration chromatique, glitch RGB,
  CRT/scanlines, vignette, grain, pixelate, wave/ripple, duotone. Nécessitent une passe de
  rendu hors matrice affine (getImageData par frame ou WebGL) → lot dédié.
- **Filtres/couleur animés** (palier 3) : hue cycle, fade in/out, strobe. Demandent un canal
  opacité/peinture par frame dans la composition (matrice-pure aujourd'hui).
- **Easing sur les effets oscillatoires** : écarté par la convention validée ci-dessus.
- Autres effets affine évoqués mais non retenus dans ce lot : `wobble` (cisaillement, exige
  d'ajouter une matrice skew), `orbit`, `breathe` — réserve.
