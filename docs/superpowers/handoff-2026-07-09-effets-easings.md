# Handoff AnimGIF — effets oscillatoires + easings (2026-07-09, 2e session)

Succède à `handoff-2026-07-09.md` (garde-le pour le lot 2a MP4 et les pièges mediabunny).
Cette session a livré **3 effets d'animation (pulse/shake/sway) + 3 easings
(easeIn/easeOut/elastic)**, sans changer l'architecture.

## Le projet en une phrase

Générateur de GIF **et MP4** animés 100 % client-side (image → retouches → effets
composables → prévisualisation → export GIF gifski-wasm **ou** MP4 WebCodecs/mediabunny),
en production : https://sandjab.github.io/animgif/ (repo `Sandjab/animgif`, public).

## État exact

- Branche `main`, tout poussé, arbre propre. **Chaque push sur main déploie en prod**
  (GitHub Actions : test + build + Pages) — ne pousser qu'un état vérifié.
- **Ce lot mergé** (PR #2, rebase) et déployé. **61 tests Vitest verts** (`npm test`,
  +6 vs les 55 du lot 2a), build propre (`npm run build` = tsc strict + vite).
- Docs de référence dans `docs/superpowers/` : specs/plans v1, v2 lot 1, lot 2a MP4,
  **lot effets/easings** (`2026-07-09-animgif-v2-effets-easings-*`), `smoke-test.md`
  (**20 points**, le 20 couvre les nouveaux effets/easings).

## Livré cette session — effets oscillatoires + easings

Enrichissement de la palette d'animation **sans toucher au moteur** : les effets restent
des matrices affines 2D produites par `effectMatrix(effect, t, view)` et consommées telles
quelles par `renderFramesChunked` (inchangé). Choisi pour le rapport effet/effort maximal.

- **3 effets oscillatoires** (gabarit `bounce` : champs `amplitude`+`oscillations`, PAS
  d'easing, boucle sans couture pour `oscillations` entier), dans `src/effects/effects.ts` :
  - **pulse** — `s = 1 + (amplitude/100)·|sin(π·k·t)|`, `scaling(s,s, cx,cy)`. Défaut 15 %, 2.
  - **shake** — `translation(A·sin(2π·k·t), A·sin(2π·(k+1)·t))` (fréquences x/y différentes
    → jitter « Lissajous »). Défaut 8 px, 6.
  - **sway** — `rotationDeg(A·sin(2π·k·t), cx, outH)` (pivot en **bas** → pendule). Défaut 10°, 2.
- **3 easings** (pour les effets « de A à B » : kenBurns/rotation/translation/spin3d), dans
  `src/effects/easing.ts` : **easeIn** `t²`, **easeOut** `t·(2−t)`, **elastic** easeOutElastic
  (`2^(−10t)·sin((10t−0.75)·2π/3)+1`, dépasse 1 puis se pose).
- **UI** (`src/ui/animPanel.ts` + `index.html`) : 3 boutons `#effect-buttons`, entrées
  `defaultEffect`/`TITLES`/`renderEffectCard`, 3 easings dans le menu `EASINGS`.
- **Type** (`src/types.ts`) : `Easing` et union `Effect` étendus.

## Convention structurante (ancrée, à respecter)

Les easings n'agissent **que** sur les effets « de A à B » (leur `t` passe par `applyEasing`).
Les effets **oscillatoires** (bounce + pulse/shake/sway) portent leur propre courbe (le `sin`)
et n'ont **pas** de champ easing — leurs cartes UI n'affichent donc pas de sélecteur d'easing.
La boucle « sans couture » de ces effets dépend d'un `oscillations` **entier** (retour à zéro
en t=1).

## Retour de revue Gemini intégré (commit `fix:`)

Gemini Code Assist a laissé 1 commentaire `medium` sur `animPanel.ts`. Intégré, **scopé aux
3 nouveaux effets** :
- Garde `NaN` (champ vidé) → valeur par défaut, pour ne pas propager `NaN` dans les matrices.
- `oscillations` contraint à un **entier ≥ 1** (`Number.isFinite ? Math.max(1, Math.round) :
  défaut`) → garantit la boucle sans couture.
- Aligné sur le garde-fou **préexistant de `spin3d`** (`turns`). **Non étendu** à
  `bounce`/`rotation`/`translation`, qui ont la même lacune préexistante (hors périmètre PR) —
  candidat à un correctif séparé si souhaité.

## Architecture (stable, ne pas casser)

Inchangée. Aucun nouveau module, aucune nouvelle dépendance, aucun changement du pipeline de
rendu/export (GIF et MP4), de la timeline, de la décimation, du garde-fou mémoire. Les 3
effets s'ajoutent comme branches de `effectMatrix` et se composent via le chemin `multiply`
existant de `composeEffects` (ce ne sont pas des kenBurns). Moteur pur → couvert par Vitest.

## Pièges connus

Tous ceux des handoffs précédents restent valides (sémantique `repeat` gifski, dédup buffers
worker, imgly 1.7.0 épinglé, bruit LSP « Cannot find module », wasm onnx mort, ordre
décimation ; côté MP4 : `BufferTarget` (pas `ArrayBufferTarget`), `await output.start()`,
`output.cancel()` sur erreur, dims paires `evenDim`, `revokeObjectURL` différé, support MP4
paresseux). Rien de neuf côté moteur (effets = affine pur).

- **Précision flottante dans les tests d'effets** : `Math.sin(Math.PI)` ≈ 1e-16 (pas 0) →
  utiliser `toBeCloseTo` (et non `toEqual`) pour les assertions de neutralité à `t=1` des
  effets oscillatoires. (Corrigé au plan avant implémentation.)

## Vérification (reconduite cette session)

- `npm test` (61/61) + `npm run build` verts.
- **Smoke-check navigateur** (Playwright MCP + `npm run dev` :5173, car jsdom ne rend pas le
  canvas) : image de test **synthétisée in-page** (canvas → `File` → `#file-input` +
  `dispatchEvent('change')`, ce qui **évite le sélecteur de fichiers** fantôme signalé au lot
  2a) ; ajout des 3 effets via les boutons → 3 cartes correctes (unités %/px/°, **sans
  easing**) ; ▶ Lecture → canvas qui s'anime (hash de frame qui change, non vide), **0 erreur/
  warning applicatif** ; capture confirmant le rendu composé (rotation + échelle). Le seul
  warning venait de mon code de sonde (`getImageData` sans `willReadFrequently`), pas de l'app.
- **Reste manuel** (non fait, faible risque) : export GIF **et** MP4 réels contenant un nouvel
  effet + un nouvel easing (le chemin d'export est inchangé et déjà éprouvé).

## Process utilisé (à reconduire)

Superpowers : brainstorming → spec → plan (code complet par tâche, revu contre la spec) →
subagent-driven-development (**1 implémenteur sonnet** a déroulé les 5 tâches en TDD, commit
par tâche ; revue conformité+qualité par le contrôleur — choix économique assumé car tâches
mécaniques sur fichiers partagés donc séquentielles) → vérif navigateur (contrôleur) → PR →
réponse au retour Gemini (dans le fil du commentaire, `pulls/.../comments/{id}/replies`) →
**merge rebase** (`gh pr merge --rebase --delete-branch`).
Commits : trailer `Claude-Session:` ; UI en français ; TDD sur le moteur pur.

**⚠️ Piège git RÉPÉTÉ (2e fois) — à corriger la prochaine fois** : les commits de doc
(spec, plan) ont **encore** été faits sur `main` local AVANT de brancher → après le
rebase-merge, `main` local a divergé (SHA réécrits), resynchro par `git reset --hard
origin/main` (aucun travail perdu, tout est dans la PR). **Leçon** : faire les commits de
spec/plan **sur la branche de feature**, jamais sur `main` local.

## Suite possible (non engagée)

- **Autres effets affine** (réserve, faciles, même gabarit) : `wobble` (cisaillement — exige
  d'ajouter une matrice skew à `matrix.ts`), `orbit` (translation circulaire), `breathe`
  (zoom lent en boucle).
- **Palier 3 — filtres/couleur animés** : hue cycle, fade in/out, strobe → demandent un canal
  opacité/peinture par frame (compo actuellement matrice-pure).
- **Palier 4 — effets pixel/shader** : aberration chromatique, glitch RGB, CRT/scanlines,
  vignette, grain, pixelate, wave/ripple, duotone → passe de rendu hors matrice affine
  (`getImageData`/WebGL), lot dédié.
- **Cohérence** : étendre la garde NaN/entier à `bounce`/`rotation`/`translation` (lacune
  préexistante laissée hors périmètre).
- **Lot 2b (spec v2, non commencé)** : tests E2E Playwright (flux import→export + parseur GIF
  en CI, extension MP4).
