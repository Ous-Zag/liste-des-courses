# Liste de courses – sur GitHub Pages, données dans le dépôt

L’application tourne entièrement sur **GitHub Pages**, sans serveur. Toutes les données sont dans **un fichier JSON** du dépôt : `data.json`, sur une branche à part nommée **`data`**. Aucune base de données.

- Chaque lecture relit `data.json` sur GitHub.
- Chaque création, modification ou suppression relit le fichier, applique le changement et l’enregistre aussitôt par **un commit** (par exemple « Ajout : plat « Riz au safran » »).
- L’historique complet des modifications se voit dans les commits de la branche `data`.
- Si deux personnes enregistrent en même temps, GitHub le détecte et l’application recommence avec la dernière version : aucune modification n’est perdue.

## Fonctionnement

1. **Catalogues** : ingrédients, produits laitiers, produits d’hygiène.
2. **Plats** : composés d’ingrédients ; **Plats à préparer** : la liste des plats prévus.
3. **À acheter** : les ingrédients sont générés depuis les plats à préparer, puis ajustables. Avec « Tout le catalogue », on coche n’importe quel article de chaque catalogue (ingrédients, produits laitiers, hygiène) et on règle sa quantité.
4. **Courses** : la liste de courses est **générée à partir de « À acheter »** (bouton « Générer la liste de courses »). Une nouvelle génération garde cochés les articles déjà dans le panier. Si « À acheter » change, un message propose de mettre la liste à jour.

Dans « Courses » et « À acheter », chaque catégorie a son accès rapide (cartes et barre de catégories), son nombre d’articles à acheter, son coût total et son coût restant.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | L’interface (5 onglets : Courses, À acheter, Plats à préparer, Plats, Catalogues) |
| `core.js` | Les règles métier (catalogues, plats, génération, blocage des suppressions) |
| `store.js` | La lecture et l’écriture de `data.json` sur GitHub |
| `seed.json` | Les données de départ (menu tunisien 14 jours), copiées dans `data.json` au premier usage |
| `test/` | Tests automatiques avec un faux GitHub : `node test/run.js` |
| `.github/workflows/pages.yml` | Lance les tests puis déploie le site à chaque modification de `main` |

## Mise en ligne

1. **Le dépôt.** Utilisez votre dépôt `liste-des-courses` (remplacez son contenu sur `main` par ce dossier) ou créez-en un nouveau. Envoyez tous les fichiers, y compris `.github` et `.nojekyll`.
2. **Pages.** Dans **Settings → Pages**, choisissez **Source : GitHub Actions**. Attendez que le workflow soit vert dans l’onglet **Actions**.
3. **Le jeton.** Créez un jeton sur https://github.com/settings/personal-access-tokens/new :
   - *Repository access* : **Only select repositories**, puis votre dépôt ;
   - *Permissions → Repository permissions → Contents* : **Read and write** ;
   - une date d’expiration (par exemple 1 an).
4. **Connexion.** Ouvrez le site (`https://VOTRE-NOM.github.io/liste-des-courses/`), cliquez sur le bouton **GitHub** en haut, collez le jeton, puis **Tester et enregistrer**. Au premier usage, l’application crée la branche `data` et le fichier `data.json` à partir de `seed.json`.

Faites l’étape 4 sur chaque téléphone ou ordinateur qui doit pouvoir modifier. Le jeton reste enregistré **sur l’appareil uniquement** ; « Oublier le jeton » l’efface.

## Bon à savoir

- **Sans jeton**, l’application est en **lecture seule** : on peut consulter la liste, mais pas cocher ni modifier.
- **Dépôt public = données publiques.** Dans un dépôt public, tout le monde peut lire `data.json` (listes, prix). Rien de personnel n’y est stocké, mais si vous préférez, rendez le dépôt privé : GitHub Pages sur un dépôt privé demande un compte payant.
- **Ne partagez jamais votre jeton** et ne le mettez pas dans un fichier du dépôt. En cas de doute, supprimez-le sur GitHub et créez-en un autre.
- Chaque enregistrement prend une à deux secondes (lecture puis commit). GitHub autorise 5 000 requêtes par heure avec un jeton, largement assez.
- **Sauvegarde et retour en arrière :** chaque version de `data.json` est dans l’historique de la branche `data`. Pour revenir en arrière, ouvrez une ancienne version sur GitHub, copiez-la et enregistrez-la à la place de l’actuelle.
- Les réglages avancés (branche et nom du fichier) sont dans la fenêtre **Connexion GitHub**.

## Tests

```bash
node test/run.js
```

Ils vérifient les règles métier et l’enregistrement sur un faux GitHub : création de la branche et du fichier, lecture seule sans jeton, jeton invalide, messages de commit, blocage des suppressions, génération des quantités, et deux appareils qui enregistrent en même temps.
