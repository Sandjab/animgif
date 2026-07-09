# Flou animé (mise au point flou↔net) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un effet d'animation « Mise au point » : une transition de flou dirigée (`fromPx → toPx`) avec easing sélectionnable, appliquée par frame en preview comme à l'export (GIF et MP4).

**Architecture:** Le flou n'est pas géométrique. On introduit un **canal filtre par frame** parallèle au canal matrice existant : `composeBlur(effects, t)` calcule un rayon de flou scalaire (px, résolution d'export), posé via `ctx.filter = blur(Xpx)` au même `drawImage` que la matrice, aux deux seuls sites de rendu (`renderFramesChunked` pour l'export, `drawFrame` pour la preview). `composeEffects` reste purement géométrique (elle ignore `blur`). MP4 et GIF consomment les `ImageData` déjà rendues → aucun encodeur modifié.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), DOM natif (pas de framework UI).

**Référence spec:** `docs/superpowers/specs/2026-07-09-animgif-v2-flou-anime-design.md`

**Convention de commit:** messages en français, style *conventional commits*. Terminer chaque message par la ligne `Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv` (adapter si exécuté dans une autre session).

**Note de décomposition :** ajouter `blur` à l'union `Effect` rend non exhaustifs le `switch` de `effectMatrix` **et** le `Record` `TITLES`. La Task 1 règle donc ces deux points en même temps que le type, pour finir verte ; le reste de l'UI (carte, bouton, défaut) vient en Task 4.

---

## Task 1: Cœur du flou animé — type `blur` + `composeBlur`

**Files:**
- Modify: `src/effects/effects.test.ts`
- Modify: `src/types.ts` (union `Effect`)
- Modify: `src/effects/effects.ts` (import `identity`, `effectMatrix`, `composeEffects`, nouvelle `composeBlur`)
- Modify: `src/ui/animPanel.ts` (une seule ligne : `TITLES.blur`, pour l'exhaustivité du `Record` — build vert)

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/effects/effects.test.ts`, ajouter un nouveau bloc `describe` après le bloc `describe('composeEffects', …)` existant (à la fin du fichier) :

```ts
describe('composeBlur', () => {
  it('vaut 0 sans effet blur', () => {
    expect(composeBlur([], 0.5)).toBe(0);
    const rot: Effect = { kind: 'rotation', fromDeg: 0, toDeg: 90, easing: 'linear' };
    expect(composeBlur([rot], 0.5)).toBe(0);
  });
  it('interpole de fromPx à toPx (easing linéaire)', () => {
    const b: Effect = { kind: 'blur', fromPx: 0, toPx: 10, easing: 'linear' };
    expect(composeBlur([b], 0)).toBeCloseTo(0);
    expect(composeBlur([b], 1)).toBeCloseTo(10);
    expect(composeBlur([b], 0.5)).toBeCloseTo(5);
  });
  it('respecte un easing non linéaire', () => {
    // easeIn(0.5) = 0.25 → 0 + 0.25 × 10 = 2.5
    const b: Effect = { kind: 'blur', fromPx: 0, toPx: 10, easing: 'easeIn' };
    expect(composeBlur([b], 0.5)).toBeCloseTo(2.5);
  });
  it('additionne plusieurs effets blur', () => {
    const b1: Effect = { kind: 'blur', fromPx: 0, toPx: 4, easing: 'linear' };
    const b2: Effect = { kind: 'blur', fromPx: 2, toPx: 2, easing: 'linear' };
    expect(composeBlur([b1, b2], 1)).toBeCloseTo(6); // 4 + 2
  });
  it('clampe à 0 les dépassements négatifs (ex. easing élastique)', () => {
    // elastic dépasse 1 → lerp(10, 0, >1) devient négatif ; un flou négatif est invalide.
    const b: Effect = { kind: 'blur', fromPx: 10, toPx: 0, easing: 'elastic' };
    const samples = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t) => composeBlur([b], t));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  });
});

describe('composeEffects × blur (garde de régression)', () => {
  it('un effet blur ne modifie jamais la géométrie', () => {
    // Le flou est un canal filtre, pas une transformation : la matrice composée doit
    // être identique avec et sans l'effet blur dans la liste.
    const rot: Effect = { kind: 'rotation', fromDeg: 0, toDeg: 90, easing: 'linear' };
    const blur: Effect = { kind: 'blur', fromPx: 0, toPx: 8, easing: 'linear' };
    const without = composeEffects([rot], 0.5, view);
    const withBlur = composeEffects([rot, blur], 0.5, view);
    expect(withBlur).toEqual(without);
  });
});
```

Puis, en haut du fichier, ajouter `composeBlur` à l'import depuis `./effects` :

```ts
import { composeBlur, composeEffects, effectMatrix, fitMatrix } from './effects';
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: FAIL — `composeBlur` n'existe pas (import non résolu) et le variant `blur` n'existe pas encore dans le type `Effect`.

- [ ] **Step 3: Ajouter le variant `blur` à l'union `Effect`**

Dans `src/types.ts`, ajouter la ligne au type `Effect` (après le variant `sway`) :

```ts
  | { kind: 'blur'; fromPx: number; toPx: number; easing: Easing };
```

(La ligne `sway` précédente perd son `;` final au profit de cette nouvelle dernière ligne : veiller à ce que seule la dernière alternative de l'union porte le `;` de fin d'instruction. Concrètement, la ligne `sway` se termine désormais par `}` sans `;`, et la ligne `blur` par `};`.)

- [ ] **Step 4: Étendre `effects.ts` (exhaustivité + `composeBlur`)**

Dans `src/effects/effects.ts` :

a) Ajouter `identity` à l'import depuis `./matrix` :

```ts
import { identity, multiply, rotationDeg, scaling, translation, type Mat } from './matrix';
```

b) Dans `effectMatrix`, ajouter un `case 'blur'` dans le `switch` (après le cas `sway`), requis par l'exhaustivité du type ; le flou n'étant pas géométrique, il rend l'identité :

```ts
    case 'blur':
      // Canal non géométrique (filtre par frame, voir composeBlur) : identité pour
      // l'exhaustivité du switch. Jamais atteint via composeEffects, qui ignore `blur`.
      return identity();
```

c) Dans `composeEffects`, étendre la condition de saut de la boucle pour ignorer aussi `blur` (comme `kenBurns`) :

```ts
    if (e.kind === 'kenBurns' || e.kind === 'blur') continue;
```

d) Ajouter la fonction `composeBlur` à la fin du fichier (après `composeEffects`) :

```ts
// Canal filtre : somme des rayons de flou (px, résolution d'export) des effets `blur`
// à l'instant t ; 0 si aucun. Chaque contribution est clampée ≥ 0 (un easing qui dépasse,
// ex. élastique, ne doit pas produire de flou négatif).
export function composeBlur(effects: Effect[], t: number): number {
  let px = 0;
  for (const e of effects) {
    if (e.kind !== 'blur') continue;
    px += Math.max(0, lerp(e.fromPx, e.toPx, applyEasing(e.easing, t)));
  }
  return px;
}
```

- [ ] **Step 5: Ajouter `TITLES.blur` (build vert)**

Dans `src/ui/animPanel.ts`, ajouter l'entrée au `Record` `TITLES` (sinon `Record<Effect['kind'], string>` devient non exhaustif → erreur de build). Ajouter après la ligne `sway: 'Balancement',` :

```ts
  blur: 'Mise au point',
```

- [ ] **Step 6: Lancer les tests pour vérifier le succès**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: PASS (tous les tests verts, dont la garde de régression).

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: succès (tsc sans erreur : `effectMatrix` et `TITLES` couvrent désormais `blur`).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/effects/effects.ts src/effects/effects.test.ts src/ui/animPanel.ts
git commit -m "feat: cœur du flou animé — type blur, composeBlur, garde géométrie

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 2: Flou par frame dans le rendu et l'export (GIF + MP4)

**Files:**
- Modify: `src/frameGenerator.test.ts`
- Modify: `src/frameGenerator.ts` (`computeFrameBlurs`, paramètre `blurs` de `renderFramesChunked`)
- Modify: `src/export.ts` (calcul et passage des flous)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/frameGenerator.test.ts`, ajouter un bloc `describe` après le bloc `computeFrameMatrices` existant :

```ts
describe('computeFrameBlurs', () => {
  it('un rayon par step, interpolé sur la séquence', () => {
    const b: Effect = { kind: 'blur', fromPx: 0, toPx: 8, easing: 'linear' };
    const blurs = computeFrameBlurs([b], 3);
    expect(blurs).toHaveLength(3);
    [0, 4, 8].forEach((v, i) => expect(blurs[i]).toBeCloseTo(v)); // t = 0, 0.5, 1
  });
  it('0 partout sans effet blur', () => {
    const tr: Effect = { kind: 'translation', dx: 10, dy: 0, easing: 'linear' };
    expect(computeFrameBlurs([tr], 4)).toEqual([0, 0, 0, 0]);
  });
});
```

Puis ajouter `computeFrameBlurs` à l'import en haut du fichier :

```ts
import { computeFrameBlurs, computeFrameMatrices } from './frameGenerator';
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/frameGenerator.test.ts`
Expected: FAIL — `computeFrameBlurs` n'existe pas.

- [ ] **Step 3: Implémenter `computeFrameBlurs`**

Dans `src/frameGenerator.ts` :

a) Ajouter `composeBlur` à l'import depuis `./effects/effects` :

```ts
import { composeBlur, composeEffects, type View } from './effects/effects';
```

b) Ajouter la fonction juste après `computeFrameMatrices` :

```ts
// Jumeau de computeFrameMatrices pour le canal filtre : un rayon de flou (px) par step.
// Pas de `view` : le flou est un scalaire en px à la résolution d'export.
export function computeFrameBlurs(effects: Effect[], steps: number): number[] {
  return sampleTimes(steps).map((t) => composeBlur(effects, t));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/frameGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Ajouter le canal flou à `renderFramesChunked`**

Dans `src/frameGenerator.ts`, ajouter le paramètre `blurs: number[]` (après `matrices`) et poser `ctx.filter` par frame. Remplacer la signature et le corps de la boucle :

Signature (ajouter `blurs` en 3e position) :

```ts
export async function renderFramesChunked(
  baked: HTMLCanvasElement,
  matrices: Mat[],
  blurs: number[],
  outW: number,
  outH: number,
  backgroundColor: string,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
  chunkSize = 4,
): Promise<ImageData[] | null> {
```

Dans la boucle, remplacer le bloc de dessin par (le fond ne doit jamais être flouté) :

```ts
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none'; // le fond n'est jamais flouté
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outW, outH);
    ctx.filter = blurs[i] > 0 ? `blur(${blurs[i]}px)` : 'none';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    frames.push(ctx.getImageData(0, 0, outW, outH));
```

- [ ] **Step 6: Câbler l'export**

Dans `src/export.ts` :

a) Ajouter `computeFrameBlurs` à l'import :

```ts
import { computeFrameBlurs, computeFrameMatrices, renderFramesChunked } from './frameGenerator';
```

b) Après la ligne `const matrices = computeFrameMatrices(s.effects, s.steps, view);`, ajouter :

```ts
      const blurs = computeFrameBlurs(s.effects, s.steps);
```

c) Modifier l'appel à `renderFramesChunked` pour passer les flous en parallèle des matrices (mêmes indices `needed`) :

```ts
      const rendered = await renderFramesChunked(
        baked, needed.map((i) => matrices[i]), needed.map((i) => blurs[i]),
        width, height, s.adjustments.backgroundColor,
        (done, total) => {
          progress.value = done / total;
          status.textContent = `Rendu des frames… (${done}/${total})`;
        },
        () => cancelled,
      );
```

- [ ] **Step 7: Vérifier build et suite complète**

Run: `npm run build && npm test`
Expected: build en succès (tsc valide la nouvelle signature à l'unique site d'appel) et tous les tests verts.

- [ ] **Step 8: Commit**

```bash
git add src/frameGenerator.ts src/frameGenerator.test.ts src/export.ts
git commit -m "feat: flou par frame dans le rendu et l'export (GIF + MP4)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 3: Flou animé dans la preview (mise à l'échelle)

**Files:**
- Modify: `src/ui/canvasView.ts` (`drawFrame`)

Site de rendu navigateur — non couvert par Vitest (jsdom sans canvas réel). Vérifié à la section *Vérification finale*.

- [ ] **Step 1: Importer `composeBlur`**

Dans `src/ui/canvasView.ts`, remplacer l'import des effets :

```ts
import { composeBlur, composeEffects } from '../effects/effects';
```

- [ ] **Step 2: Poser le flou dans `drawFrame`**

Dans `drawFrame`, remplacer le corps (à partir du calcul de `m`) par (le flou est défini à la résolution d'export → mis à l'échelle par le facteur d'aperçu ; remis à `none` avant l'overlay d'édition) :

```ts
    const effects = store.get().effects;
    const m = composeEffects(effects, t, view);
    const scale = w / store.get().outW; // même facteur que previewSize
    const blurPx = composeBlur(effects, t) * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none'; // le fond n'est jamais flouté
    ctx.fillStyle = store.get().adjustments.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    ctx.filter = 'none'; // neutre avant l'overlay (l'éditeur Ken Burns ne doit pas être flouté)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (t === 0 && showOverlay) overlay?.(); // jamais d'overlay d'édition pendant la lecture
```

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 4: Commit**

```bash
git add src/ui/canvasView.ts
git commit -m "feat: flou animé dans la preview (mise à l'échelle export→aperçu)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 4: Effet « Mise au point » dans l'UI (flou↔net)

**Files:**
- Modify: `src/ui/animPanel.ts` (`defaultEffect`, `renderEffectCard`)
- Modify: `index.html` (`#effect-buttons`)

(`TITLES.blur` a déjà été ajouté en Task 1.)

- [ ] **Step 1: Ajouter le défaut**

Dans `src/ui/animPanel.ts`, dans `defaultEffect`, ajouter le cas avant `default:` :

```ts
    case 'blur':
      return { kind: 'blur', fromPx: 0, toPx: 8, easing: 'easeInOut' };
```

- [ ] **Step 2: Ajouter la carte d'édition**

Dans `renderEffectCard`, ajouter le cas dans le `switch` (par ex. après `sway`), avec durcissement des entrées (`NaN` → défaut, clamp `[0, 100]`), à l'image des effets oscillatoires :

```ts
    case 'blur':
      card.appendChild(numberField('Flou départ (px)', effect.fromPx, (fromPx) =>
        patch({ fromPx: Number.isFinite(fromPx) ? Math.min(100, Math.max(0, fromPx)) : 0 })));
      card.appendChild(numberField('Flou arrivée (px)', effect.toPx, (toPx) =>
        patch({ toPx: Number.isFinite(toPx) ? Math.min(100, Math.max(0, toPx)) : 8 })));
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
```

- [ ] **Step 3: Ajouter le bouton**

Dans `index.html`, ajouter le bouton dans `#effect-buttons` (après `<button data-effect="spin3d">+ Flip 3D</button>`) :

```html
            <button data-effect="blur">+ Mise au point</button>
```

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 5: Commit**

```bash
git add src/ui/animPanel.ts index.html
git commit -m "feat: effet « Mise au point » dans l'UI (flou↔net)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 5: Documentation (README + smoke-test)

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/smoke-test.md`

- [ ] **Step 1: Mettre à jour le README**

Dans `README.md`, remplacer la puce des effets d'animation par (ajout de « mise au point (flou↔net) ») :

```markdown
- Effets d'animation composables : zoom/Ken Burns (rectangles départ/arrivée), rotation, translation, bounce, flip 3D, pulse, shake, balancement, mise au point (flou↔net) — avec easing (linéaire, ease in/out, rebond, élastique)
```

- [ ] **Step 2: Ajouter un point au smoke-test**

Dans `docs/superpowers/smoke-test.md`, ajouter à la fin de la liste (après le point 20) :

```markdown
21. Ajouter « Mise au point » (défaut 0→8 px) → ▶ : l'image se floute progressivement puis
    revient nette à la boucle. Régler Flou départ = 8, Flou arrivée = 0 → sens inverse
    (flou→net). Exporter un GIF **et** un MP4 contenant l'effet → le flou animé est présent
    dans les deux, cohérent avec la preview.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/smoke-test.md
git commit -m "docs: mise au point (flou↔net) dans README et smoke-test

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Vérification finale (navigateur)

Non couvert par Vitest (jsdom sans canvas réel) — à dérouler manuellement après le lot :

- [ ] `npm run dev`, charger une image.
- [ ] Ajouter « Mise au point » (défaut 0→8) → ▶ : l'image passe de nette à floue, en douceur (easeInOut), et boucle proprement.
- [ ] Régler Flou départ = 8, Flou arrivée = 0 → l'image se précise (flou→net).
- [ ] Vérifier qu'un flou statique dans les Retouches sert de plancher (flou animé additif, indépendant).
- [ ] Vérifier que la preview et l'export ont une intensité de flou visuellement cohérente (mise à l'échelle correcte) à différentes tailles d'export.
- [ ] Exporter un GIF **et** un MP4 contenant l'effet → le flou animé apparaît dans les deux formats, conforme à la preview.
- [ ] Ajouter un effet géométrique (ex. Rotation) **et** « Mise au point » ensemble → la rotation n'est pas déformée par le flou (géométrie intacte).
