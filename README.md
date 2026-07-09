# AnimGIF

Générateur de GIF animés à partir d'une image fixe — 100 % dans le navigateur,
aucune donnée envoyée à un serveur.

**App en ligne :** https://sandjab.github.io/animgif/

## Fonctionnalités

- Import par fichier ou glisser-déposer
- Retouches : luminosité, contraste, saturation, miroir, rotation 90°, suppression du fond (IA locale), couleur de fond
- Filtres : sépia, noir & blanc, teinte, flou, inversion
- Effets d'animation composables : zoom/Ken Burns (rectangles départ/arrivée), rotation, translation, bounce, flip 3D — avec easing
- Prévisualisation : délai réglable, boucle infinie / n fois / ping-pong, lecture inversée
- Export GIF haute qualité (encodeur [gifski](https://github.com/ImageOptim/gifski) en WebAssembly), dimensions et qualité configurables, décimation de frames (poids réduit, durée préservée), progression et annulation
- Export MP4/H.264 (WebCodecs via [mediabunny](https://github.com/vanilagy/mediabunny), chargé à la demande ; requiert un navigateur compatible WebCodecs) : une seule passe, la boucle est gérée par le lecteur

## Développement

```bash
npm install
npm run dev    # serveur de dev
npm test       # tests unitaires (Vitest)
npm run build  # build de production (dist/)
```

Déploiement automatique sur GitHub Pages à chaque push sur `main`.
Spec et plan : `docs/superpowers/`. Smoke test manuel : `docs/superpowers/smoke-test.md`.

## Limitations connues

- Seul le modèle de détourage `isnet_quint8` est auto-hébergé (`public/bg-removal/`).
