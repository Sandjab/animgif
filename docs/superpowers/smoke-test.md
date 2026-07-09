# Smoke test manuel AnimGIF

À dérouler avant chaque release (2 minutes) :

1. Ouvrir l'app (dev ou prod). Glisser une photo JPEG → l'image s'affiche.
2. Glisser un fichier .txt → message d'erreur, app intacte.
3. Pousser saturation à 2, luminosité à 1.3 → aperçu mis à jour en direct.
4. « Supprimer le fond » → progression, puis sujet détouré sur la couleur de fond.
5. Ajouter Zoom/Ken Burns → déplacer/redimensionner les 2 rectangles (vert = départ, rouge = arrivée).
6. Ajouter Rotation 0→360, easing linéaire. Steps = 24. Taper la valeur au clavier :
   le champ garde le focus.
7. ▶ Lecture → animation fluide, sans flash des rectangles d'édition ;
   slider délai à 40 ms → accélère en direct.
8. Boucle ping-pong → aller-retour sans à-coup.
9. Export 480×480 qualité 80 → GIF téléchargé, l'ouvrir : conforme à la preview,
   boucle infinie.
10. Boucle « n fois » = 2 → le GIF s'arrête après 2 lectures, et la prévisualisation
    s'arrête d'elle-même après 2 passages.
11. Sépia à 1 puis N&B à 1 → aperçu suit ; inversion → négatif.
12. Ajouter Flip 3D (axe Y, 1 tour) → ▶ : l'image « tourne » (écrasement puis miroir).
13. Cocher « Lecture inversée » → l'animation joue à rebours (preview et GIF exporté).
14. Décimation « 1 sur 2 » → GIF exporté avec 2× moins de frames, même durée totale.
15. Lancer un gros export (2048 px, 120 steps, accepter l'avertissement mémoire) puis
    Annuler pendant le rendu → « Export annulé. », pas de téléchargement, bouton réactivé.
16. Choisir Format « MP4 » → sur navigateur compatible : le bouton devient « Exporter le
    MP4 » et la ligne d'aide « Une seule passe… » apparaît (sur navigateur sans WebCodecs :
    retour à GIF, option MP4 désactivée, message « MP4 non supporté »).
17. Exporter en MP4 480×480 → fichier .mp4 téléchargé ; l'ouvrir : lecture correcte,
    dimensions paires, durée = frames × délai, conforme à la preview.
18. Format MP4 avec dimensions impaires (ex. 481) → le MP4 sort en 480 (arrondi au pair).
19. Gros export MP4, Annuler pendant l'encodage → « Export annulé. », aucun téléchargement,
    bouton réactivé.
20. Ajouter Pulse, Shake et Balancement (un à la fois) → ▶ : battement, secousse et
    pendule visibles, boucle sans à-coup. Sur un effet Rotation, choisir l'easing
    « Élastique » → la rotation dépasse puis se stabilise.
