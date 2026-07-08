# AnimGIF

Générateur de GIF animés à partir d'une image fixe — 100 % dans le navigateur,
aucune donnée envoyée à un serveur.

**App en ligne :** https://sandjab.github.io/animgif/

## Fonctionnalités

- Import par fichier ou glisser-déposer
- Retouches : luminosité, contraste, saturation, miroir, rotation 90°, suppression du fond (IA locale), couleur de fond
- Effets d'animation composables : zoom/Ken Burns (rectangles départ/arrivée), rotation, translation, bounce — avec easing
- Prévisualisation : délai réglable, boucle infinie / n fois / ping-pong
- Export GIF haute qualité (encodeur [gifski](https://github.com/ImageOptim/gifski) en WebAssembly), dimensions et qualité configurables

## Développement

```bash
npm install
npm run dev    # serveur de dev
npm test       # tests unitaires (Vitest)
npm run build  # build de production (dist/)
```

Déploiement automatique sur GitHub Pages à chaque push sur `main`.
Spec et plan : `docs/superpowers/`. Smoke test manuel : `docs/superpowers/smoke-test.md`.

## Limitations connues (v1)

- Le rendu pleine résolution des frames à l'export est synchrone : l'onglet peut se figer
  quelques secondes sur de gros exports (le garde-fou mémoire prévient au-delà de ~500 Mo au pic).
- Seul le modèle de détourage `isnet_quint8` est auto-hébergé (`public/bg-removal/`).
