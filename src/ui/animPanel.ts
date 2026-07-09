import type { Store } from '../state';
import type { Easing, Effect } from '../types';

function defaultEffect(kind: string, store: Store): Effect {
  const img = store.get().sourceImage!;
  const w = img.naturalWidth, h = img.naturalHeight;
  switch (kind) {
    case 'kenBurns':
      return { kind: 'kenBurns', from: { x: 0, y: 0, w, h }, to: { x: w / 4, y: h / 4, w: w / 2, h: h / 2 }, easing: 'easeInOut' };
    case 'rotation':
      return { kind: 'rotation', fromDeg: 0, toDeg: 360, easing: 'linear' };
    case 'translation':
      return { kind: 'translation', dx: 50, dy: 0, easing: 'easeInOut' };
    case 'spin3d':
      return { kind: 'spin3d', axis: 'y', turns: 1, easing: 'linear' };
    case 'pulse':
      return { kind: 'pulse', amplitude: 15, oscillations: 2 };
    case 'shake':
      return { kind: 'shake', amplitude: 8, oscillations: 6 };
    case 'sway':
      return { kind: 'sway', amplitude: 10, oscillations: 2 };
    case 'blur':
      return { kind: 'blur', fromPx: 0, toPx: 8, easing: 'easeInOut' };
    default:
      return { kind: 'bounce', amplitude: 30, oscillations: 1 };
  }
}

const EASINGS: [Easing, string][] = [
  ['linear', 'Linéaire'], ['easeInOut', 'Ease in-out'], ['bounce', 'Rebond'],
  ['easeIn', 'Ease in'], ['easeOut', 'Ease out'], ['elastic', 'Élastique'],
];

function numberField(label: string, value: number, onChange: (v: number) => void): HTMLLabelElement {
  const el = document.createElement('label');
  el.textContent = label + ' ';
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value)));
  el.appendChild(input);
  return el;
}

function easingField(value: Easing, onChange: (e: Easing) => void): HTMLLabelElement {
  const el = document.createElement('label');
  el.textContent = 'Easing ';
  const select = document.createElement('select');
  for (const [v, txt] of EASINGS) {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = txt; opt.selected = v === value;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => onChange(select.value as Easing));
  el.appendChild(select);
  return el;
}

const TITLES: Record<Effect['kind'], string> = {
  kenBurns: 'Zoom / Ken Burns', rotation: 'Rotation', translation: 'Translation', bounce: 'Bounce',
  spin3d: 'Flip 3D',
  pulse: 'Pulse',
  shake: 'Shake',
  sway: 'Balancement',
  blur: 'Mise au point',
};

function renderEffectCard(effect: Effect, index: number, store: Store): HTMLElement {
  const card = document.createElement('div');
  card.className = 'effect-card';
  const patch = (p: Partial<Effect>) => {
    const effects = [...store.get().effects];
    effects[index] = { ...effects[index], ...p } as Effect;
    store.update({ effects });
  };
  const title = document.createElement('h3');
  title.textContent = TITLES[effect.kind];
  const del = document.createElement('button');
  del.textContent = '✕';
  del.addEventListener('click', () => {
    store.update({ effects: store.get().effects.filter((_, i) => i !== index) });
  });
  title.appendChild(del);
  card.appendChild(title);

  switch (effect.kind) {
    case 'kenBurns': {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Ajustez les rectangles Départ (vert) et Arrivée (rouge) sur l\'image.';
      card.appendChild(hint);
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
    }
    case 'rotation':
      card.appendChild(numberField('De (°)', effect.fromDeg, (fromDeg) => patch({ fromDeg })));
      card.appendChild(numberField('À (°)', effect.toDeg, (toDeg) => patch({ toDeg })));
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
    case 'translation':
      card.appendChild(numberField('dx (px)', effect.dx, (dx) => patch({ dx })));
      card.appendChild(numberField('dy (px)', effect.dy, (dy) => patch({ dy })));
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
    case 'bounce':
      card.appendChild(numberField('Amplitude (px)', effect.amplitude, (amplitude) => patch({ amplitude })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) => patch({ oscillations })));
      break;
    // Effets oscillatoires : entrées gardées comme spin3d. NaN (champ vidé) → défaut ;
    // oscillations contraint à un entier ≥ 1 pour préserver la boucle sans couture.
    case 'pulse':
      card.appendChild(numberField('Amplitude (%)', effect.amplitude, (amplitude) =>
        patch({ amplitude: Number.isFinite(amplitude) ? amplitude : 15 })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) =>
        patch({ oscillations: Number.isFinite(oscillations) ? Math.max(1, Math.round(oscillations)) : 2 })));
      break;
    case 'shake':
      card.appendChild(numberField('Amplitude (px)', effect.amplitude, (amplitude) =>
        patch({ amplitude: Number.isFinite(amplitude) ? amplitude : 8 })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) =>
        patch({ oscillations: Number.isFinite(oscillations) ? Math.max(1, Math.round(oscillations)) : 6 })));
      break;
    case 'sway':
      card.appendChild(numberField('Amplitude (°)', effect.amplitude, (amplitude) =>
        patch({ amplitude: Number.isFinite(amplitude) ? amplitude : 10 })));
      card.appendChild(numberField('Oscillations', effect.oscillations, (oscillations) =>
        patch({ oscillations: Number.isFinite(oscillations) ? Math.max(1, Math.round(oscillations)) : 2 })));
      break;
    case 'blur':
      // Effet dirigé (comme rotation) : deux bornes + easing. NaN (champ vidé) → défaut ;
      // flou borné [0, 100] px (négatif invalide, au-delà de 100 coûteux sans gain visuel).
      card.appendChild(numberField('Flou départ (px)', effect.fromPx, (fromPx) =>
        patch({ fromPx: Number.isFinite(fromPx) ? Math.min(100, Math.max(0, fromPx)) : 0 })));
      card.appendChild(numberField('Flou arrivée (px)', effect.toPx, (toPx) =>
        patch({ toPx: Number.isFinite(toPx) ? Math.min(100, Math.max(0, toPx)) : 8 })));
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
    case 'spin3d': {
      const axis = document.createElement('label');
      axis.textContent = 'Axe ';
      const select = document.createElement('select');
      for (const [v, txt] of [['y', 'Vertical (Y)'], ['x', 'Horizontal (X)']] as const) {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = txt; opt.selected = v === effect.axis;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => patch({ axis: select.value as 'x' | 'y' }));
      axis.appendChild(select);
      card.appendChild(axis);
      card.appendChild(numberField('Tours', effect.turns, (turns) =>
        patch({ turns: Number.isFinite(turns) ? Math.max(0.25, turns) : 0.25 })));
      card.appendChild(easingField(effect.easing, (easing) => patch({ easing })));
      break;
    }
  }
  return card;
}

export function initAnimPanel(store: Store) {
  const list = document.querySelector<HTMLElement>('#effects-list')!;

  document.querySelectorAll<HTMLButtonElement>('#effect-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.effect!;
      if (kind === 'kenBurns' && store.get().effects.some((e) => e.kind === 'kenBurns')) return; // un seul kenBurns
      store.update({ effects: [...store.get().effects, defaultEffect(kind, store)] });
    });
  });

  document.querySelector<HTMLInputElement>('#anim-steps')!.addEventListener('input', (e) => {
    const v = Math.max(2, Math.min(120, Number((e.target as HTMLInputElement).value) || 2));
    store.update({ steps: v });
  });

  document.querySelector<HTMLInputElement>('#anim-reverse')!.addEventListener('change', (e) => {
    store.update({ reverse: (e.target as HTMLInputElement).checked });
  });

  // Re-render seulement quand la STRUCTURE de la liste change (ajout/suppression) :
  // re-rendre à chaque édition de valeur détruirait l'input en cours de frappe (perte de focus).
  // Les index capturés par les cartes restent valides tant que la structure ne change pas.
  let lastSignature: string | null = null;
  store.subscribe(() => {
    const { effects } = store.get();
    const signature = effects.map((e) => e.kind).join(',');
    if (signature === lastSignature) return;
    lastSignature = signature;
    list.replaceChildren(...effects.map((e, i) => renderEffectCard(e, i, store)));
  });
}
