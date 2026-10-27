# Liste des courses – Menu tunisien 14 jours

Une page web pour faire les courses au marché : chaque article se coche, et passe de « À acheter » à « Dans le panier ».
La liste est lue directement dans le fichier Excel `data/liste_courses_menu_tunisien.xlsx`.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page (tout le code est dans ce fichier) |
| `data/liste_courses_menu_tunisien.xlsx` | Le fichier Excel source : plats, ingrédients, prix, hygiène, liste des courses |
| `favicon.svg` | L’icône du site |
| `.github/workflows/pages.yml` | Déploiement automatique sur GitHub Pages à chaque modification |
| `.nojekyll` | Indique à GitHub Pages de publier les fichiers tels quels |

## Mise en ligne (une seule fois)

1. Créez un dépôt sur GitHub, par exemple `liste-des-courses` (public, ou privé avec un compte GitHub Pro).
2. Envoyez-y tous les fichiers de ce dossier, **y compris** les dossiers `.github` et `data` :
   - en ligne : « Add file » puis « Upload files », et glissez le contenu du dossier ;
   - ou en ligne de commande :
     ```bash
     git init
     git add .
     git commit -m "Liste des courses"
     git branch -M main
     git remote add origin https://github.com/VOTRE-NOM/liste-des-courses.git
     git push -u origin main
     ```
3. Dans le dépôt, ouvrez **Settings → Pages**, et dans « Build and deployment », choisissez **Source : GitHub Actions**.
4. Ouvrez l’onglet **Actions** : le déploiement se lance. Quand il est vert, le site est en ligne à l’adresse
   `https://VOTRE-NOM.github.io/liste-des-courses/`.

## Mettre la liste à jour

1. Ouvrez `data/liste_courses_menu_tunisien.xlsx` dans Excel et modifiez ce que vous voulez (plats « Oui / Non », quantités manuelles, prix, articles d’hygiène…).
2. **Enregistrez dans Excel** : la page lit les valeurs calculées, que seul l’enregistrement dans Excel (ou LibreOffice) met à jour.
3. Remplacez le fichier dans le dossier `data/` du dépôt, sans changer son nom (« Add file → Upload files » sur GitHub, ou `git commit` puis `git push`).
4. Le site se met à jour en une à deux minutes.

Sur la page, le bouton « Charger le fichier Excel » permet aussi de tester un autre fichier sur un seul appareil, sans le publier.

## Bon à savoir

- Les cases cochées sont enregistrées dans le navigateur de chaque appareil : deux téléphones ne partagent pas leurs coches.
- La page a besoin d’Internet au premier chargement (polices Google Fonts et lecteur Excel SheetJS depuis cdnjs).
- Si le fichier Excel ne peut pas être lu, la page affiche la liste intégrée (celle du 26 octobre 2026).
- Pour tester en local, ouvrez le dossier avec un petit serveur (`python -m http.server`) puis `http://localhost:8000` : en ouvrant `index.html` directement, le navigateur bloque la lecture du fichier Excel et la liste intégrée s’affiche.
