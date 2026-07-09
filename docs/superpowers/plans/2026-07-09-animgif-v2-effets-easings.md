# Effets oscillatoires + easings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 3 effets d'animation oscillatoires (pulse, shake, sway) et 3 easings (easeIn, easeOut, elastic) au générateur AnimGIF, sans toucher à l'architecture.

**Architecture:** Les effets restent des matrices affines 2D produites par `effectMatrix(effect, t, view)` et consommées telles quelles par le pipeline de rendu. Les effets oscillatoires suivent le gabarit exact de `bounce` (deux champs, pas d'easing) ; les easings enrichissent `applyEasing` et bénéficient aux effets « de A à B ». Rien d'autre du moteur n'est modifié.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), DOM natif (pas de framework UI).

**Référence spec:** `docs/superpowers/specs/2026-07-09-animgif-v2-effets-easings-design.md`

**Convention de commit:** messages en français, style *conventional commits*. Terminer chaque message par la ligne `Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv` (adapter si exécuté dans une autre session).

---

## Task 1: Easings (easeIn, easeOut, elastic)

**Files:**
- Modify: `src/effects/easing.test.ts`
- Modify: `src/types.ts` (type `Easing`)
- Modify: `src/effects/easing.ts` (`applyEasing`)
- Modify: `src/ui/animPanel.ts` (tableau `EASINGS`)

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/effects/easing.test.ts`, remplacer le test « préserve les bornes » et ajouter 3 tests de caractère. Le fichier complet devient :

```ts
import { describe, expect, it } from 'vitest';
import { applyEasing } from './easing';

describe('applyEasing', () => {
  it('préserve les bornes 0 et 1 pour tous les easings', () => {
    for (const e of ['linear', 'easeInOut', 'bounce', 'easeIn', 'easeOut', 'elastic'] as const) {
      expect(applyEasing(e, 0)).toBeCloseTo(0);
      expect(applyEasing(e, 1)).toBeCloseTo(1);
    }
  });
  it('linear est identité', () => {
    expect(applyEasing('linear', 0.25)).toBeCloseTo(0.25);
  });
  it('easeInOut est symétrique et passe par 0.5', () => {
    expect(applyEasing('easeInOut', 0.5)).toBeCloseTo(0.5);
    expect(applyEasing('easeInOut', 0.2)).toBeCloseTo(1 - applyEasing('easeInOut', 0.8));
    expect(applyEasing('easeInOut', 0.2)).toBeLessThan(0.2); // démarre lentement
  });
  it('bounce dépasse puis revient (rebond en fin de course)', () => {
    // easeOutBack : dépasse 1 avant de s'y poser
    const overshoot = Math.max(...[0.7, 0.8, 0.9].map((t) => applyEasing('bounce', t)));
    expect(overshoot).toBeGreaterThan(1);
  });
  it('easeIn démarre sous la diagonale (accélère)', () => {
    expect(applyEasing('easeIn', 0.5)).toBeLessThan(0.5);
  });
  it('easeOut finit au-dessus de la diagonale (décélère)', () => {
    expect(applyEasing('easeOut', 0.5)).toBeGreaterThan(0.5);
  });
  it('elastic dépasse 1 avant de se poser (ressort)', () => {
    const samples = [0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8].map((t) => applyEasing('elastic', t));
    expect(Math.max(...samples)).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/effects/easing.test.ts`
Expected: FAIL — les nouveaux easings ne sont pas gérés, `applyEasing('easeIn', …)` retourne `undefined` → assertions en échec.

- [ ] **Step 3: Étendre le type `Easing`**

Dans `src/types.ts`, remplacer la ligne du type `Easing` par :

```ts
export type Easing = 'linear' | 'easeInOut' | 'bounce' | 'easeIn' | 'easeOut' | 'elastic';
```

- [ ] **Step 4: Implémenter les branches dans `applyEasing`**

Dans `src/effects/easing.ts`, ajouter les 3 cas avant l'accolade fermante du `switch` (après le cas `bounce`) :

```ts
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'elastic': {
      // easeOutElastic : oscillation amortie qui dépasse 1 puis se stabilise.
      if (t === 0) return 0;
      if (t === 1) return 1;
      const c4 = (2 * Math.PI) / 3;
      return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
```

- [ ] **Step 5: Lancer les tests pour vérifier le succès**

Run: `npx vitest run src/effects/easing.test.ts`
Expected: PASS (tous les tests verts).

- [ ] **Step 6: Exposer les easings dans l'UI**

Dans `src/ui/animPanel.ts`, remplacer la constante `EASINGS` par :

```ts
const EASINGS: [Easing, string][] = [
  ['linear', 'Linéaire'], ['easeInOut', 'Ease in-out'], ['bounce', 'Rebond'],
  ['easeIn', 'Ease in'], ['easeOut', 'Ease out'], ['elastic', 'Élastique'],
];
```

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: succès (tsc sans erreur + build Vite).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/effects/easing.ts src/effects/easing.test.ts src/ui/animPanel.ts
git commit -m "feat: easings easeIn/easeOut/elastic

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 2: Effet Pulse (battement)

**Files:**
- Modify: `src/effects/effects.test.ts`
- Modify: `src/types.ts` (union `Effect`)
- Modify: `src/effects/effects.ts` (`effectMatrix`)
- Modify: `src/ui/animPanel.ts` (`defaultEffect`, `TITLES`, `renderEffectCard`)
- Modify: `index.html` (`#effect-buttons`)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/effects/effects.test.ts`, à l'intérieur du bloc `describe('effectMatrix', …)` (après le test `spin3d axe X`), ajouter :

```ts
  it('pulse : échelle 1 (identité) à t=0 et t=1, dilate au pic autour du centre', () => {
    const e: Effect = { kind: 'pulse', amplitude: 20, oscillations: 1 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // t=0 → s=1 → identité (sin(0)=0 exact)
    expect(apply(effectMatrix(e, 0, sq), { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
    // t=1 → sin(π)≈0 → s≈1 → quasi identité (toBeCloseTo : sin(π) n'est pas exactement 0)
    const p1 = apply(effectMatrix(e, 1, sq), { x: 10, y: 10 });
    expect(p1.x).toBeCloseTo(10);
    expect(p1.y).toBeCloseTo(10);
    // t=0.5 → sin(π/2)=1 → s=1.2 ; centre (50,50) fixe, point à droite s'éloigne de 20%
    const c = apply(effectMatrix(e, 0.5, sq), { x: 50, y: 50 });
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(50);
    const p = apply(effectMatrix(e, 0.5, sq), { x: 60, y: 50 });
    expect(p.x).toBeCloseTo(62); // 50 + 10 * 1.2
  });
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: FAIL — `effectMatrix` ne gère pas `pulse`, retourne `undefined` → `apply(undefined, …)` lève une erreur.

- [ ] **Step 3: Ajouter le variant `pulse` à l'union `Effect`**

Dans `src/types.ts`, ajouter la ligne au type `Effect` (après le variant `spin3d`) :

```ts
  | { kind: 'pulse'; amplitude: number; oscillations: number }
```

- [ ] **Step 4: Ajouter la branche `pulse` dans `effectMatrix`**

Dans `src/effects/effects.ts`, ajouter le cas dans le `switch` de `effectMatrix` (après le cas `spin3d`) :

```ts
    case 'pulse': {
      // Échelle uniforme oscillante autour du centre de sortie ; part de 1, culmine, revient à 1.
      const s = 1 + (effect.amplitude / 100) * Math.abs(Math.sin(Math.PI * effect.oscillations * t));
      return scaling(s, s, view.outW / 2, view.outH / 2);
    }
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: PASS.

- [ ] **Step 6: Câbler l'UI**

Dans `src/ui/animPanel.ts` :

a) Dans `defaultEffect`, ajouter le cas avant `default:` :

```ts
    case 'pulse':
      return { kind: 'pulse', amplitude: 15, oscillations: 2 };
```

b) Dans `TITLES`, ajouter l'entrée :

```ts
  pulse: 'Pulse',
```

c) Dans `renderEffectCard`, ajouter le cas dans le `switch` (à côté de `bounce`) :

```ts
    case 'pulse':
      card.appendChild(numberField('Amplitude (%)', effect.amplitude, (amplitude) => patch({ amplitude })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) => patch({ oscillations })));
      break;
```

Dans `index.html`, ajouter le bouton dans `#effect-buttons` (après le bouton Bounce) :

```html
            <button data-effect="pulse">+ Pulse</button>
```

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: succès. (Le build force la complétude : `TITLES` couvre tous les `kind`, et `effectMatrix` retourne sur tous les chemins.)

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/effects/effects.ts src/effects/effects.test.ts src/ui/animPanel.ts index.html
git commit -m "feat: effet pulse (battement, échelle oscillante)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 3: Effet Shake (secousse)

**Files:**
- Modify: `src/effects/effects.test.ts`
- Modify: `src/types.ts` (union `Effect`)
- Modify: `src/effects/effects.ts` (`effectMatrix`)
- Modify: `src/ui/animPanel.ts` (`defaultEffect`, `TITLES`, `renderEffectCard`)
- Modify: `index.html` (`#effect-buttons`)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/effects/effects.test.ts`, dans le bloc `describe('effectMatrix', …)` (après le test `pulse`), ajouter :

```ts
  it('shake : déplacement nul à t=0 et t=1 (oscillations entières), non nul entre-temps', () => {
    const e: Effect = { kind: 'shake', amplitude: 10, oscillations: 2 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // translation pure : (0,0) mesure le déplacement
    const p0 = apply(effectMatrix(e, 0, sq), { x: 0, y: 0 });
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    const p1 = apply(effectMatrix(e, 1, sq), { x: 0, y: 0 });
    expect(p1.x).toBeCloseTo(0);
    expect(p1.y).toBeCloseTo(0);
    // fréquences x/y différentes → déplacement non nul à mi-parcours d'une oscillation
    const p = apply(effectMatrix(e, 0.1, sq), { x: 0, y: 0 });
    expect(Math.abs(p.x) + Math.abs(p.y)).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: FAIL — `effectMatrix` ne gère pas `shake`.

- [ ] **Step 3: Ajouter le variant `shake` à l'union `Effect`**

Dans `src/types.ts`, ajouter la ligne au type `Effect` (après le variant `pulse`) :

```ts
  | { kind: 'shake'; amplitude: number; oscillations: number }
```

- [ ] **Step 4: Ajouter la branche `shake` dans `effectMatrix`**

Dans `src/effects/effects.ts`, ajouter le cas dans le `switch` (après le cas `pulse`) :

```ts
    case 'shake': {
      // Jitter de translation : fréquences différentes en x et y (k et k+1) → aspect « tremblé »
      // façon Lissajous ; les deux composantes valent 0 en t=0 et t=1 (oscillations entières).
      const dx = effect.amplitude * Math.sin(2 * Math.PI * effect.oscillations * t);
      const dy = effect.amplitude * Math.sin(2 * Math.PI * (effect.oscillations + 1) * t);
      return translation(dx, dy);
    }
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: PASS.

- [ ] **Step 6: Câbler l'UI**

Dans `src/ui/animPanel.ts` :

a) Dans `defaultEffect`, ajouter le cas avant `default:` :

```ts
    case 'shake':
      return { kind: 'shake', amplitude: 8, oscillations: 6 };
```

b) Dans `TITLES`, ajouter l'entrée :

```ts
  shake: 'Shake',
```

c) Dans `renderEffectCard`, ajouter le cas dans le `switch` :

```ts
    case 'shake':
      card.appendChild(numberField('Amplitude (px)', effect.amplitude, (amplitude) => patch({ amplitude })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) => patch({ oscillations })));
      break;
```

Dans `index.html`, ajouter le bouton dans `#effect-buttons` :

```html
            <button data-effect="shake">+ Shake</button>
```

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/effects/effects.ts src/effects/effects.test.ts src/ui/animPanel.ts index.html
git commit -m "feat: effet shake (secousse, jitter de translation)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 4: Effet Sway (balancement)

**Files:**
- Modify: `src/effects/effects.test.ts`
- Modify: `src/types.ts` (union `Effect`)
- Modify: `src/effects/effects.ts` (`effectMatrix`)
- Modify: `src/ui/animPanel.ts` (`defaultEffect`, `TITLES`, `renderEffectCard`)
- Modify: `index.html` (`#effect-buttons`)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/effects/effects.test.ts`, dans le bloc `describe('effectMatrix', …)` (après le test `shake`), ajouter :

```ts
  it('sway : angle nul à t=0 et t=1, pivote autour du bas du viewport', () => {
    const e: Effect = { kind: 'sway', amplitude: 30, oscillations: 1 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // t=0 → 0° → identité
    const a0 = apply(effectMatrix(e, 0, sq), { x: 50, y: 0 });
    expect(a0.x).toBeCloseTo(50);
    expect(a0.y).toBeCloseTo(0);
    // t=1 → sin(2π)=0 → 0° → identité
    const a1 = apply(effectMatrix(e, 1, sq), { x: 50, y: 0 });
    expect(a1.x).toBeCloseTo(50);
    expect(a1.y).toBeCloseTo(0);
    // pivot en bas (50,100) fixe quel que soit t
    const pivot = apply(effectMatrix(e, 0.25, sq), { x: 50, y: 100 });
    expect(pivot.x).toBeCloseTo(50);
    expect(pivot.y).toBeCloseTo(100);
    // à t=0.25, sin(π/2)=1 → 30° ; un point au sommet se déplace latéralement
    const top = apply(effectMatrix(e, 0.25, sq), { x: 50, y: 0 });
    expect(top.x).not.toBeCloseTo(50);
  });
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: FAIL — `effectMatrix` ne gère pas `sway`.

- [ ] **Step 3: Ajouter le variant `sway` à l'union `Effect`**

Dans `src/types.ts`, ajouter la ligne au type `Effect` (après le variant `shake`) :

```ts
  | { kind: 'sway'; amplitude: number; oscillations: number }
```

- [ ] **Step 4: Ajouter la branche `sway` dans `effectMatrix`**

Dans `src/effects/effects.ts`, ajouter le cas dans le `switch` (après le cas `shake`) :

```ts
    case 'sway': {
      // Balancement pendulaire : rotation oscillante autour du bas du viewport (effet « suspendu »).
      const deg = effect.amplitude * Math.sin(2 * Math.PI * effect.oscillations * t);
      return rotationDeg(deg, view.outW / 2, view.outH);
    }
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/effects/effects.test.ts`
Expected: PASS.

- [ ] **Step 6: Câbler l'UI**

Dans `src/ui/animPanel.ts` :

a) Dans `defaultEffect`, ajouter le cas avant `default:` :

```ts
    case 'sway':
      return { kind: 'sway', amplitude: 10, oscillations: 2 };
```

b) Dans `TITLES`, ajouter l'entrée :

```ts
  sway: 'Balancement',
```

c) Dans `renderEffectCard`, ajouter le cas dans le `switch` :

```ts
    case 'sway':
      card.appendChild(numberField('Amplitude (°)', effect.amplitude, (amplitude) => patch({ amplitude })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) => patch({ oscillations })));
      break;
```

Dans `index.html`, ajouter le bouton dans `#effect-buttons` :

```html
            <button data-effect="sway">+ Balancement</button>
```

- [ ] **Step 7: Vérifier le build et la suite complète**

Run: `npm run build && npm test`
Expected: build en succès et tous les tests verts.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/effects/effects.ts src/effects/effects.test.ts src/ui/animPanel.ts index.html
git commit -m "feat: effet sway (balancement pendulaire)

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Task 5: Documentation (README + smoke-test)

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/smoke-test.md`

- [ ] **Step 1: Mettre à jour le README**

Dans `README.md`, remplacer la puce des effets d'animation par :

```markdown
- Effets d'animation composables : zoom/Ken Burns (rectangles départ/arrivée), rotation, translation, bounce, flip 3D, pulse, shake, balancement — avec easing (linéaire, ease in/out, rebond, élastique)
```

- [ ] **Step 2: Ajouter un point au smoke-test**

Dans `docs/superpowers/smoke-test.md`, ajouter à la fin de la liste :

```markdown
20. Ajouter Pulse, Shake et Balancement (un à la fois) → ▶ : battement, secousse et
    pendule visibles, boucle sans à-coup. Sur un effet Rotation, choisir l'easing
    « Élastique » → la rotation dépasse puis se stabilise.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/smoke-test.md
git commit -m "docs: pulse/shake/sway et nouveaux easings dans README et smoke-test

Claude-Session: https://claude.ai/code/session_01LzgHmX6RqUCZ4aE69kKgTv"
```

---

## Vérification finale (navigateur)

Non couvert par Vitest (jsdom sans canvas réel) — à dérouler manuellement après le lot :

- [ ] `npm run dev`, charger une image.
- [ ] Ajouter Pulse → ▶ : l'image bat régulièrement, revient à sa taille.
- [ ] Ajouter Shake → ▶ : tremblement nerveux, boucle propre.
- [ ] Ajouter Balancement → ▶ : oscillation pendulaire depuis le bas.
- [ ] Sur un effet Rotation, easing « Élastique » puis « Ease out » → courbe conforme.
- [ ] Exporter un GIF **et** un MP4 contenant au moins un nouvel effet → lecture conforme à la preview.
```
