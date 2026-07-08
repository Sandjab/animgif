# AnimGIF — Générateur de GIF animés à partir d'une image fixe

**Date** : 2026-07-08
**Statut** : validé (brainstorming du 2026-07-08)

## Objectif

Application web statique, 100 % côté client, qui transforme une image fixe en GIF animé :
import d'une image, retouches unitaires, effets d'animation paramétriques générant n frames,
prévisualisation avec délai réglable, export GIF de haute qualité.

Hébergement : GitHub Pages (aucun serveur, aucune donnée ne quitte le navigateur).

## Décisions actées

| Sujet | Décision |
|---|---|
| Stack | Vite + TypeScript, sans framework UI (DOM direct + Canvas 2D) |
| Encodage GIF | `gifski-wasm` (vrai gifski compilé en WebAssembly), dans un Web Worker |
| Remove background | `@imgly/background-removal` (+ `onnxruntime-web`), chargé à la demande, modèle auto-hébergé |
| Effets d'animation | Combinables (composition de matrices affines) |
| Hébergement | GitHub Pages via GitHub Actions à chaque push sur `main` |
| Alternatives écartées | App Swift native (macOS 15+, Vision + ImageIO ou gifski Rust) — écartée au profit de la distribution par URL et de gifski sans friction |

## Fonctionnalités v1

### Source
- Import par file picker **et** drag & drop (PNG, JPEG, WebP…) ; fichier non-image refusé avec message clair.

### Retouches unitaires (appliquées une fois, résultat mis en cache)
- Luminosité, contraste, saturation (sliders, aperçu temps réel).
- Flip horizontal / vertical, rotation 90°.
- Suppression du fond (bouton dédié, indicateur de téléchargement du modèle au premier usage).
- Couleur de fond configurable (visible après remove background, rotation, zoom-out).

### Effets d'animation (cumulables, paramètre commun : nombre de steps global)
- **Zoom / Ken Burns** : rectangle de départ et rectangle d'arrivée dessinés directement sur le
  canvas (poignées de redimensionnement) — couvre zoom + translation combinés.
- **Rotation** : angle de départ → angle d'arrivée.
- **Translation** : déplacement x/y.
- **Bounce** : oscillation (amplitude, nombre d'oscillations).
- Chaque effet a son **easing** : linéaire, ease-in-out, rebond.

### Prévisualisation
- Lecteur play/pause sur canvas, basse résolution (~480 px) pour la fluidité.
- Slider de délai inter-frames avec équivalent FPS affiché.
- Modes de boucle : infinie, n fois, **ping-pong** (aller-retour).

### Export
- Dimensions de sortie configurables (verrou des proportions).
- Curseur de qualité gifski.
- Loop count écrit dans le GIF (infini ou n fois) ; le ping-pong est « cuit » dans les frames.
- Rendu pleine résolution → worker gifski → barre de progression → téléchargement.
- Garde-fou : avertissement si l'export est déraisonnable (ex. 300 frames × 4K).

## Architecture

```
src/
  state.ts            // état central (source, retouches, effets, timing) + pub/sub minimal
  adjustments.ts      // retouches unitaires : filtres canvas + remove background (lazy)
  effects/            // 1 effet = f(t ∈ [0,1], params) → matrice affine ; composition ; easings
  frameGenerator.ts   // rend les n frames (offscreen canvas, basse ou pleine résolution)
  preview.ts          // lecteur : timer, délai, ping-pong
  export.ts           // worker gifski-wasm : taille, qualité, loop count, téléchargement
  ui/                 // panneaux DOM ; aucun accès direct au canvas de rendu
```

### Principes
- **Effets = fonctions pures** `(t, params) → matrice affine`. Les effets actifs se composent par
  multiplication de matrices ; l'easing transforme `t` en amont. Testable sans navigateur.
- **Pipeline de rendu** : image source → retouches (cachées) → pour chaque step :
  transform composée → frame. Preview basse résolution ; export re-rend en pleine résolution.
- **Workers** : encodage gifski et remove background hors du thread UI.
- L'UI ne lit/écrit que `state.ts` (pub/sub) ; les modules moteur ignorent le DOM.

## IHM (une seule page, trois zones)

- **Gauche — Source & Retouches** : import, sliders de retouche, flip/rotation, remove background,
  couleur de fond.
- **Centre — Canvas** : aperçu temps réel ; édition des rectangles Ken Burns in situ.
- **Droite — Animation & Export** : liste d'effets (ajout/suppression, paramètres, easing),
  nombre de steps, lecteur + délai + mode de boucle, bouton Export (dimensions, qualité).

## Gestion des erreurs

- Fichier invalide → message inline, état inchangé.
- Échec de chargement du modèle bg-removal (offline) → message réseau ; le reste de l'app
  fonctionne sans cette feature.
- WebGPU absent → fallback CPU automatique (géré par onnxruntime-web).
- GitHub Pages ne permet pas les en-têtes COOP/COEP : si le multithread WASM devient nécessaire,
  utiliser `coi-serviceworker` ; sinon rester mono-thread/WebGPU.

## Tests

- **Vitest** sur la logique pure : easings, composition de matrices, échantillonnage des steps,
  calcul délai/FPS, bornes ping-pong, validation des paramètres d'export.
- Smoke test manuel documenté : import → retouche → animation → export, vérification du GIF produit.
- Playwright : optionnel, v2.

## Hors périmètre v1 (candidats v2)

- Reverse, texte sur les frames, filtres artistiques (posterize, vignette…).
- Export APNG / WebP / MP4 ; optimiseur de poids du GIF.
- Presets d'animation partageables ; copie du GIF au presse-papiers (support navigateur limité).
- Playwright pour les tests E2E.

## Références

- gifski : https://github.com/ImageOptim/gifski — port WASM : https://www.npmjs.com/package/gifski-wasm
  (fork web : https://github.com/jamsinclair/gifski-lite)
- Remove background : https://github.com/imgly/background-removal-js
- Inspirations fonctionnelles : Gifski.app (qualité, bounce, dimensions), PanGIF (keyframes
  rectangulaires), supertool Image Zoom GIF Creator (Ken Burns, easing, couleur de fond),
  ezgif.com (loop count, flip/rotation, boîte à outils).
