# AnimGIF v2 — lot 1 : nouveaux effets, filtres, poids et confort d'export

**Date** : 2026-07-08
**Statut** : validé (discussion du 2026-07-08)
**Base** : v1 en production (https://sandjab.github.io/animgif/), spec `2026-07-08-animgif-design.md`

## Objectif

Enrichir la v1 sans toucher à son architecture : deux transformations nouvelles (reverse,
flip 3D), une réduction de poids (décimation de frames), cinq filtres natifs, et le
remboursement des deux dettes UX identifiées par les revues v1 (mode « n fois » en
prévisualisation, rendu d'export bloquant et non annulable).

## Périmètre (lot 1)

### 1. Lecture inversée (reverse)
- Case à cocher « Lecture inversée » dans le panneau Animation.
- Inverse l'ordre de base des frames ; le mode de boucle (infini / n fois / ping-pong)
  s'applique ensuite sur cet ordre inversé.
- Vaut pour la prévisualisation ET l'export. État : `reverse: boolean` (défaut `false`).
- Moteur : fonction pure d'ordre des frames (composée avec `pingPongOrder`), testée.

### 2. Flip 3D (`spin3d`)
- Nouvel effet composable : `{ kind: 'spin3d'; axis: 'x' | 'y'; turns: number; easing: Easing }`.
- Projection parallèle (pas de perspective) : matrice `scaling` dont le facteur de l'axe
  concerné vaut `cos(2π · turns · eased(t))`, centrée sur la sortie. Au-delà de 90° l'image
  apparaît en miroir (comportement « carte translucide », assumé).
- `turns` ≥ 0.25, pas de 0.25 (0.5 = demi-tour, 1 = tour complet). Défaut : 1 tour, axe Y,
  easing linéaire.
- S'insère dans le pipeline de matrices existant, composable avec tous les effets, testé
  sous Vitest (bornes t=0/0.5/1, miroir à mi-tour, centre fixe).
- **Hors périmètre** : perspective réelle (homographie par bandes) — en réserve, ne sera
  engagée que si le flip plat s'avère visuellement insuffisant à l'usage.

### 3. Décimation de frames (réduction de poids)
- Sélecteur dans le bloc Export : « Toutes les frames / 1 sur 2 / 1 sur 3 ».
- À l'export uniquement : ne garde qu'une frame sur n **et multiplie le délai par n**
  (la durée totale de l'animation est préservée). État : `decimation: 1 | 2 | 3` (défaut 1).
- Moteur : fonction pure `(order, delayMs, n) → { order, delayMs }`, testée (y compris
  l'interaction avec ping-pong : la décimation s'applique à l'ordre final).
- Le garde-fou mémoire utilise le nombre de frames décimé.

### 4. Cinq filtres natifs supplémentaires
- Extension de `Adjustments` et de `buildFilterString` (même mécanique `ctx.filter`) :
  - `sepia` (0–1, défaut 0), `grayscale` (0–1, défaut 0), `hueRotate` (0–360°, défaut 0),
    `blur` (0–10 px, défaut 0), `invert` (booléen, défaut faux).
- Sliders (et case pour invert) dans le panneau Retouches, aperçu temps réel via le
  pipeline de bake existant. `buildFilterString` étendu et testé (valeurs neutres omises,
  unités correctes : `hue-rotate(90deg)`, `blur(2px)`).
- Ordre d'application documenté dans `buildFilterString` (l'ordre CSS filter est significatif) :
  luminosité, contraste, saturation, sépia, N&B, teinte, inversion, flou.

### 5. Dette UX — « n fois » en prévisualisation
- En mode `count`, la lecture s'arrête d'elle-même après `loopCount` passages de la
  séquence (bouton revient à « ▶ Lecture », dernière frame affichée).
- Retirer la ligne correspondante des « Limitations connues » du README.

### 6. Dette UX — rendu d'export non bloquant et annulable
- `renderFrames` devient asynchrone par tranches (rendre ~4 frames puis céder la main),
  avec callback de progression → la barre d'export devient **déterminée** pendant la
  phase de rendu (elle reste indéterminée pendant l'encodage gifski, qui ne remonte rien).
- Bouton « Annuler » visible pendant l'export : pendant le rendu, interrompt la boucle ;
  pendant l'encodage, `worker.terminate()`. Dans les deux cas : état restauré, message
  « Export annulé. », aucun téléchargement.
- Statuts distincts : « Rendu des frames… (k/n) » puis « Encodage gifski… ».
- Retirer la limitation « rendu synchrone » du README.

## Contraintes

- Aucun changement d'architecture : effets = matrices, moteur pur testé, UI via le Store.
- `npm test` et `npm run build` verts à chaque tâche ; smoke test mis à jour
  (reverse, flip 3D, décimation, filtres, annulation).
- Textes UI en français.

## Hors périmètre (lot 2 et réserve)

- Export MP4 (WebCodecs + mp4-muxer) et tests E2E Playwright → **lot 2**.
- Perspective réelle pour spin3d, texte sur frames, presets partageables (URL),
  posterize/vignette/noise → réserve.
- Copie presse-papiers : **abandonnée** (pas de support navigateur pour `image/gif`).
