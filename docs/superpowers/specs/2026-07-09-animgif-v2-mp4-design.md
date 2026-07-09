# AnimGIF v2 — lot 2a : export MP4 (WebCodecs via mediabunny)

**Date** : 2026-07-09
**Statut** : validé (discussion du 2026-07-09)
**Base** : v1 + v2 lot 1 en production (https://sandjab.github.io/animgif/),
specs `2026-07-08-animgif-design.md` et `2026-07-08-animgif-v2-design.md`.

## Objectif

Ajouter un second format d'export — MP4/H.264 — sans toucher à l'architecture ni au
chemin GIF existant. Tout l'avant du pipeline d'export (ordre des frames, décimation,
lecture inversée, rendu par tranches annulable, garde-fou mémoire) est réutilisé tel
quel ; seul le backend d'encodage change.

Note de découpage : le « lot 2 » du handoff regroupait deux sous-projets indépendants —
l'export MP4 (cette spec, **lot 2a**) et les tests E2E Playwright (**lot 2b**, cycle
séparé, hors périmètre ici).

## Décision de dépendance

Encodage + muxing via **mediabunny** (`Output` + `Mp4OutputFormat` + `ArrayBufferTarget`
+ `CanvasSource`), successeur officiel et activement maintenu de `mp4-muxer`/`webm-muxer`
(même auteur). Il orchestre l'encodeur WebCodecs, la backpressure et la détection de
support ; on écrit donc ~30 lignes au lieu de piloter `VideoEncoder` à la main. Le poids
bundle n'est pas discriminant ici (l'app embarque déjà gifski-wasm et le modèle IA), et
mediabunny est tree-shakeable. Le handoff mentionnait `mp4-muxer` ; ce choix le remplace
sciemment.

## Périmètre (lot 2a)

### 1. État : format de sortie
- `AppState.format: 'gif' | 'mp4'` (défaut `'gif'`).
- Aucun autre champ d'état nouveau : dimensions, qualité, décimation, reverse, boucle
  sont partagés entre les deux formats.

### 2. UI — sélecteur de format
- Radios **Format** (« GIF » / « MP4 ») en tête du bloc export.
- Libellé du bouton d'export dynamique : « Exporter le GIF » / « Exporter le MP4 ».
- **Détection de support paresseuse**, à la **première sélection du format MP4** (et non
  au démarrage) : mediabunny — donc son poids — n'est téléchargé que si l'utilisateur
  engage le MP4. Cohérent avec le soin du projet pour ce que les visiteurs téléchargent
  (détourage IA en chargement paresseux). À la sélection, on charge le module via `import()`
  et on appelle le helper d'encodabilité `canEncode('avc')`. Si le navigateur ne peut pas
  encoder de l'AVC : on repasse en GIF, la radio MP4 est **désactivée** et un texte
  `MP4 non supporté par ce navigateur.` s'affiche. Les visiteurs GIF-only ne téléchargent
  jamais mediabunny.
- Ligne d'aide affichée quand MP4 est actif et supporté : `Une seule passe ; la boucle est
  gérée par le lecteur.` (même élément que le message de non-support, texte selon l'état).

### 3. Qualité — curseur réutilisé, remappé en bitrate
- Le curseur « Qualité » (1–100) pilote gifski en GIF **et** est remappé en bitrate pour
  le MP4 via une fonction pure `qualityToBitrate(quality, width, height, fps) → number`
  (bits/s), monotone croissante en `quality` et proportionnée à `width·height·fps`, bornée
  à des valeurs raisonnables. Testée sous Vitest.

### 4. Sémantique de boucle en MP4
- Le conteneur MP4 n'a pas de drapeau de boucle. `reverse` et `ping-pong` restent honorés
  car déjà encodés dans l'**ordre des frames** (`decimatedOrder`, inchangé).
- Modes `infinite` et `count` : **une seule passe** de la séquence est écrite, quel que
  soit le mode. La boucle est déléguée au lecteur (comportement documenté par la ligne
  d'aide UI). Aucune duplication physique de frames.

### 5. Encodage MP4 — backend
- Nouvelle fonction (module dédié, ex. `src/mp4.ts`) :
  `encodeMp4(frames: ImageData[], opts: { width, height, fps, bitrate, onProgress:(done,total)=>void, isCancelled:()=>boolean }) → Promise<Blob>` (type `video/mp4`),
  ou `null` si annulée.
- Implémentation : `Output({ target: new ArrayBufferTarget(), format: new Mp4OutputFormat() })`,
  une piste vidéo `CanvasSource` (codec `avc`, bitrate), un canvas réutilisé sur lequel on
  `putImageData` chaque frame avant `source.add(timestamp, duration)`. `output.start()`
  avant la boucle, `output.finalize()` après ; le `Blob` provient de `target.buffer`.
- **Thread principal** : WebCodecs est asynchrone/non bloquant (contrairement à gifski,
  synchrone → worker) et mediabunny gère la backpressure via l'`await source.add(...)`.
- **Dimensions paires** : H.264 (yuv420) exige des dimensions paires. On arrondit les
  dimensions d'export vers le bas au pair (`evenDim(v) = v - (v % 2)`, min 16) **et on rend
  les frames à ces dimensions** (l'arrondi précède `renderFramesChunked`). Fonction pure
  testée.
- **Cadence** : `fps = 1000 / delayMs` (le délai est uniforme). Timestamp de la frame `i`
  cumulé, durée par frame = `delayMs`. L'unité exacte (secondes vs microsecondes) attendue
  par l'API mediabunny sera fixée au plan.
- **Progression déterminée aux deux phases** (on connaît le nombre de frames) : statuts
  « Rendu des frames… (k/n) » puis « Encodage MP4… (k/n) ». (En GIF, la phase d'encodage
  gifski reste indéterminée — inchangé.)
- **Annulation** : le bouton Annuler existant interrompt la boucle de rendu (comme
  aujourd'hui) puis, pendant l'encodage, met `isCancelled` à vrai et abandonne l'`Output`
  (pas de `finalize`, ressources libérées). Dans tous les cas : état restauré, message
  « Export annulé. », aucun téléchargement.

### 6. Aiguillage dans `export.ts`
- Le gestionnaire du bouton export branche sur `s.format` **après** la phase de rendu
  commune :
  - `'gif'` → chemin gifski existant (worker, `repeat`, `image/gif`), inchangé.
  - `'mp4'` → `encodeMp4(...)` → `Blob('video/mp4')` → téléchargement `animation.mp4`.
- **Garde-fou mémoire** : pour MP4 le pic réel est plus bas que pour GIF (file d'encodeur
  bornée, pas de concaténation 2× la séquence dans un worker). On retire le terme `2×`
  du calcul pour le format MP4 ; le calcul GIF reste identique.

## Contraintes

- Aucun changement d'architecture : le moteur pur (effets = matrices, `decimatedOrder`,
  `renderFramesChunked`) est inchangé et reste testé. L'UI ne parle qu'au Store.
- Le chemin GIF existant n'est pas modifié fonctionnellement (seul l'aiguillage `format`
  s'ajoute autour).
- `npm test` et `npm run build` verts à chaque tâche.
- Textes UI en français.

## Tests et vérification

- **Unitaires Vitest** (jsdom n'a pas WebCodecs) : `qualityToBitrate` (monotonie, bornes,
  échelle pixels×fps) et `evenDim` (pair, plancher 16, entrées impaires/limites). L'ordre
  et le délai restent couverts par les tests existants de `decimatedOrder`.
- **Non testé en unitaire** : l'encodage mediabunny/WebCodecs (browser-only).
- **Vérification navigateur** (comme pour le GIF v1/v2) : exporter un MP4, confirmer qu'il
  se lit, aux bonnes dimensions (paires), avec la bonne durée et le bon nombre de frames ;
  vérifier l'annulation (rendu ET encodage) et la désactivation du format sur navigateur
  sans support AVC. La codification E2E automatisée relève du lot 2b.

## Documentation

- README : ajouter le format MP4 aux fonctionnalités d'export ; mentionner la sémantique
  « une seule passe / boucle côté lecteur » et la dépendance au support WebCodecs.
- `smoke-test.md` : ajouter les points MP4 (sélection format, export/lecture, dimensions
  paires, annulation, navigateur sans support).

## Hors périmètre (lot 2b et réserve)

- **Lot 2b** : tests E2E Playwright (codification des vérifications manuelles + parseur GIF
  en CI, extension au MP4) — cycle spec → plan → implémentation séparé.
- **Réserve** : audio, codecs VP9/AV1 et conteneur WebM, durées par-frame variables,
  bitrate/CRF avancé, encodage MP4 en worker (OffscreenCanvas) si le thread principal
  s'avère insuffisant à l'usage.
