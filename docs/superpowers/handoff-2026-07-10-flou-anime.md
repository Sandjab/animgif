# Handoff AnimGIF — flou animé « Mise au point » (2026-07-10)

Succède à `handoff-2026-07-09-effets-easings.md` (garde-le pour la convention des effets
oscillatoires et les easings). Cette session a livré le **premier effet non géométrique** du
projet : **« Mise au point »** (flou animé flou↔net), qui introduit un **canal filtre par frame**
à côté du canal matrice existant.

## Le projet en une phrase

Générateur de GIF **et MP4** animés 100 % client-side (image → retouches → effets composables
→ prévisualisation → export GIF gifski-wasm **ou** MP4 WebCodecs/mediabunny), en production :
https://sandjab.github.io/animgif/ (repo `Sandjab/animgif`, public).

## État exact

- Branche `main`, tout poussé, arbre propre. **Chaque push sur main déploie en prod**
  (GitHub Actions `deploy.yml` : test + build + Pages) — ne pousser qu'un état vérifié.
- **Ce lot mergé** (PR #3, rebase, branche supprimée) et **déployé** (run `deploy.yml` vert sur
  le SHA de merge). **70 tests Vitest verts** (`npm test`, +9 vs les 61 du lot précédent),
  build propre (`npm run build` = tsc strict + vite).
- Docs de référence dans `docs/superpowers/` : specs/plans v1, v2 lot 1, lot 2a MP4, lot
  effets/easings, **lot flou animé** (`2026-07-09-animgif-v2-flou-anime-*`), `smoke-test.md`
  (**21 points**, le 21 couvre « Mise au point » GIF+MP4).

## Livré cette session — effet `blur` (« Mise au point »)

Transition de flou **dirigée** `fromPx → toPx` avec easing (comme rotation/translation).
Couvre net→flou (`0→8`), flou→net (`8→0`), flou→flou. Défaut `0→8 px`, `easeInOut`.

**Nouveauté architecturale : canal filtre par frame.** Les effets existants sont tous
géométriques (`effectMatrix` → matrice affine). Le flou ne l'est pas → il ne passe PAS par la
matrice :
- `composeBlur(effects, t): number` (`src/effects/effects.ts`) — somme des rayons de flou (px,
  résolution d'export) des effets `blur`, chaque contribution clampée ≥ 0 (`Math.max(0, lerp(
  fromPx, toPx, applyEasing(easing, t)))`). Retourne 0 si aucun `blur`.
- `composeEffects` **ignore** `blur` (`continue`, comme kenBurns) → **la géométrie n'est jamais
  déformée** (garde de régression testée). `effectMatrix` a un `case 'blur': return identity()`
  requis pour l'exhaustivité du switch (jamais atteint via `composeEffects`).
- `computeFrameBlurs(effects, steps)` (`src/frameGenerator.ts`) — jumeau de
  `computeFrameMatrices`, un rayon par step.
- **Application** via `ctx.filter = blur(Xpx)` aux **deux seuls sites de rendu**, posé au même
  `drawImage` que la matrice : `renderFramesChunked` (export, pleine résolution — nouveau param
  `blurs: number[]` en 3ᵉ position) et `drawFrame` (`src/ui/canvasView.ts`, preview). Le fond
  (`fillRect`) n'est **jamais** flouté : `ctx.filter = 'none'` avant de le peindre.
- **GIF et MP4 héritent du flou gratuitement** : ils consomment les `ImageData` déjà rendues →
  `mp4.ts` et le worker gifski **inchangés**.
- **UI** (`src/ui/animPanel.ts` + `index.html`) : bouton `+ Mise au point`, carte calquée sur
  `rotation` (deux `numberField` px + `easingField`), durcissement `Number.isFinite(v) ?
  clamp[0,100] : défaut` (motif des effets oscillatoires). `TITLES.blur = 'Mise au point'`.
- **Type** (`src/types.ts`) : `| { kind: 'blur'; fromPx: number; toPx: number; easing: Easing }`.

## Contrat de résolution (point subtil, à respecter)

`fromPx`/`toPx` sont définis **en px à la résolution d'export**. Les matrices s'auto-adaptent à
la résolution (`view.outW`), mais `ctx.filter` NON : le rayon de flou est en pixels du canvas
courant, **indépendant de la CTM**. Donc :
- Export (`renderFramesChunked`) : rayon utilisé **tel quel** (pleine résolution).
- Preview (`drawFrame`) : rayon **× `scale`** où `scale = w / store.outW` (facteur d'aperçu, le
  même que `previewSize`) → la preview représente fidèlement le flou relatif de l'export.
- Le flou statique des Retouches (`Adjustments.blur`, cuit dans `baked`) et le flou animé (par
  frame) sont **additifs et indépendants** (espaces/étapes de pipeline différents).

**Hypothèse porteuse VÉRIFIÉE (pas seulement raisonnée)** : mesure Playwright d'un bord net
flouté à `blur(8px)` dessiné à CTM scale 1 vs 4 → profils de flou **identiques** (bord=135,
+4px=182, +8px≈219 dans les deux cas) → `ctx.filter` blur bien indépendant de la CTM → le
facteur `*scale` du preview est correct.

## Retour de revue Gemini intégré

Gemini Code Assist a laissé **2 commentaires `medium`** (revue *COMMENTED*, non bloquante),
tous deux traités **en fil** (`pulls/3/comments/{id}/replies`) :
- **`canvasView.ts` — division par 0 sur `store.get().outW`** : **appliqué** (commit `fix:`).
  `const outW = store.get().outW; const scale = outW > 0 ? w / outW : 1;`. `outW` vaut 480 par
  défaut et est borné ≥ 16 par `clampDim` (division par 0 inatteignable) → garde purement
  défensive/documentaire.
- **`effects.ts` — `?? 0`/`?? 8` sur `fromPx`/`toPx` dans `composeBlur`** : **décliné**, avec
  raisons postées : (1) store **en mémoire**, aucune persistance/désérialisation → pas de
  scénario « projet mal formé » ; l'invariant « champs finis » est garanti à la frontière UI
  (comme pulse/shake/sway), les fonctions de calcul n'y re-coalescent pas volontairement ; (2)
  `??` ne rattrape **pas** `NaN` (seulement `null`/`undefined`) → le correctif ne fait pas ce
  qu'il vise. `composeBlur` reste pure.

## Architecture (ce qui a changé / ce qui est stable)

- **Changé** : introduction du canal filtre par frame (le premier écart au « tout matrice »),
  contenu à `composeBlur`/`computeFrameBlurs` + 2 sites de rendu. Aucune nouvelle dépendance,
  aucun changement des encodeurs (GIF/MP4), de la timeline, de la décimation, du garde-fou
  mémoire, de l'annulation.
- **Stable** : `composeEffects` (géométrie), le pipeline d'export, le parcours d'indices
  (`needed`/`order`) — le flou réutilise **les mêmes indices** que les matrices, donc hérite
  automatiquement de la décimation/reverse/ping-pong (vérifié en revue d'intégration).

## Pièges connus

Tous ceux des handoffs précédents restent valides (sémantique `repeat` gifski, dédup buffers
worker, imgly épinglé, wasm onnx mort, ordre décimation ; côté MP4 : `BufferTarget`, `await
output.start()`, `output.cancel()` sur erreur, dims paires `evenDim`, `revokeObjectURL`
différé, support MP4 paresseux).

- **Bruit LSP « Cannot find module » RÉCURRENT** : les diagnostics injectés dans l'IDE étaient
  systématiquement **périmés** (fichiers fantômes `plan_*.ts`, modules existants marqués
  introuvables) après chaque édition de sous-agent. Toujours vérifier avec `npx tsc --noEmit`
  réel, jamais se fier aux diagnostics injectés.
- **`ctx.filter` invalide** (ex. `blur(Infinitypx)`) → le navigateur **ignore** l'affectation et
  garde la valeur précédente ; combiné au garde `blurPx > 0`, aucun plantage même en cas de
  valeur dégénérée.
- **Overlay Ken Burns net à t=0** : `drawFrame` remet `ctx.filter='none'` avant `overlay?.()`
  (l'éditeur de rectangles ne doit pas être flouté) — d'où une frame d'édition nette à l'arrêt,
  qui se floute à la lecture. Voulu.

## Vérification (cette session)

- `npm test` (70/70) + `npm run build` verts, y compris sur le résultat **mergé** sur `main`.
- **Mesure navigateur ciblée** (Playwright) de l'indépendance CTM du flou `ctx.filter` (voir
  « Contrat de résolution ») → facteur `*scale` du preview validé par la preuve.
- **Reste manuel** (non fait, faible risque, = smoke-test point 21) : ajout réel de « Mise au
  point » en preview (net→flou et 8→0), et export GIF **et** MP4 contenant l'effet, à comparer
  visuellement à la preview à différentes tailles d'export.

## Process utilisé (à reconduire)

Superpowers : brainstorming → spec → plan (code complet par tâche) → subagent-driven-development
(**implémenteurs sonnet**, 1 par tâche, TDD, commit par tâche ; **revue 2 étages par tâche** —
conformité spec puis qualité — + **revue finale d'intégration**, toutes en opus/sonnet) →
**vérif navigateur par mesure** (contrôleur) → PR → réponse au retour Gemini en fil → **merge
rebase** (`gh pr merge --rebase --delete-branch`). Commits : trailer `Claude-Session:` ; UI en
français ; TDD sur le moteur pur.

**✅ Piège git du handoff précédent ÉVITÉ cette fois** : la branche `feat/flou-anime` a été créée
**avant** les commits de spec/plan, qui ont donc été faits **sur la branche** (jamais sur `main`
local). Pas de divergence, pas de resynchro à faire. **À reconduire : brancher d'abord.**

## Suite possible (non engagée)

- **Palier 3 — autres filtres animés** : maintenant que le **canal filtre par frame existe**,
  hue cycle / fade in-out / strobe / saturation animée sont faciles (même canal `composeBlur`-
  like + `ctx.filter`). Lot direct.
- **Cohérence (optionnel)** : borner supérieurement `composeBlur` (aujourd'hui seulement ≥ 0) si
  les dépassements d'easings élastiques au-delà de 100 px deviennent gênants — laissé volontaire
  (par effet, per spec) ; le défaut 0→8 ne dépasse jamais.
- **Palier 4 — effets pixel/shader** : aberration chromatique, glitch RGB, CRT, grain,
  pixelate, wave/ripple → passe de rendu hors `ctx.filter` (`getImageData`/WebGL), lot dédié.
- **Effets affine en réserve** : `wobble` (skew), `orbit`, `breathe`.
- **Lot 2b (spec v2, non commencé)** : tests E2E Playwright (flux import→export en CI).
