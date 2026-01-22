# 🤖 Comprendre l'Automatisation GitHub Actions

Ce document explique comment votre projet se met à jour tout seul grâce à **GitHub Actions**.

## 🔄 Le Processus Global

Le fichier de configuration qui pilote tout cela est : `.github/workflows/update.yml`.
Voici ce qu'il fait, étape par étape, à chaque lancement :

### 1. Le Déclencheur (Trigger)
L'action se lance automatiquement dans deux cas :
*   📅 **Tous les jours à 04h00 (Heure de Paris)** : Grâce à la ligne `cron: '0 3 * * *'`.
*   🚀 **À chaque modification (Push)** : Dès que vous envoyez du code depuis votre ordinateur vers GitHub.

### 2. L'Environnement (Le "Robot")
GitHub démarre un ordinateur virtuel (sous Linux Ubuntu) spécialement pour vous.
*   Il installe **Python 3.11**.
*   Il installe les librairies nécessaires listées dans `requirements.txt` (`pandas`, `requests`, `pyarrow`).

### 3. L'Exécution de la Pipeline (Vos Scripts)
Le robot exécute vos scripts Python dans l'ordre exact, comme vous le feriez sur votre PC :

1.  **`src/01_fetch_data.py`** 🌍
    *   Vérifie si un nouvel export WCA est disponible.
    *   Télécharge le ZIP géant de la WCA.
    *   Extrait les fichiers `.tsv` bruts.

2.  **`src/02_extract_wca_v2.py`** 🔍
    *   Lit les fichiers géants par petits bouts ("chunks").
    *   Filtre uniquement les résultats des joueurs configurés dans `config.py`.
    *   Sauvegarde ces données filtrées (beaucoup plus légères) pour la suite.

3.  **`src/03_build_stats.py`** 📊
    *   Calcule les statistiques (Records PR, Timeline, progression par round).
    *   Génère les fichiers JSON qui alimentent les graphiques du site.

4.  **`src/04_build_map.py`** 🗺️
    *   Génère les données pour la carte (villes visitées, etc.).

5.  **`src/05_sync_web_data.py`** 📂
    *   Copie tous les résultats calculés (dossier `out/`) vers le dossier du site web (`web/data/`).

### 4. Le Déploiement (Mise en ligne)
Une fois que le dossier `web/` est prêt et rempli de données fraîches :
*   GitHub Actions "upload" ce dossier comme un **artefact**.
*   Il le déploie automatiquement sur **GitHub Pages**.
*   Votre site (ex: `https://votre-pseudo.github.io/v2/`) est mis à jour instantanément.

## 🛠️ Comment intervenir ?

*   **Pour changer l'heure** : Modifiez la ligne `cron` dans `.github/workflows/update.yml`.
*   **Pour changer les joueurs** : Modifiez `src/config.py` et faites un "Push". Le site se mettra à jour dans les minutes qui suivent.
*   **Pour voir si tout va bien** : Allez dans l'onglet **Actions** de votre dépôt GitHub.
    *   🟢 **Vert** = Succès.
    *   🔴 **Rouge** = Erreur (cliquez dessus pour voir les logs et comprendre pourquoi).
