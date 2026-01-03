# WCA Analytics Dashboard 📊

Ce projet permet de visualiser les résultats de compétiteurs WCA via une interface interactive (Timeline, Historique complet, Carte).

## 🚀 Routine de mise à jour des données

Pour mettre à jour le dashboard avec les derniers résultats officiels de la WCA, exécutez les commandes suivantes dans l'ordre, depuis la racine du projet :

### 1. Récupération de l'export WCA
Vérifie si un nouvel export est disponible et le télécharge automatiquement.
```powershell
python src/01_fetch_data.py
```

### 2. Filtrage des données
Extrait uniquement les résultats des joueurs définis dans `src/config.py`.
```powershell
python src/02_extract_wca_v2.py
```

### 3. Calcul des statistiques
Génère les records personnels, les classements par round et l'historique chronologique.
```powershell
python src/03_build_stats.py
```

### 4. Génération de la carte
Prépare les données de géolocalisation pour les compétitions visitées.
```powershell
python src/04_build_map.py
```

### 5. Déploiement local
Synchronise les fichiers calculés vers le dossier du site web.
```powershell
python src/05_sync_web_data.py
```

---

## 💻 Visualisation locale

Une fois les données mises à jour, lancez un serveur local pour consulter le site :

```powershell
cd web
python -m http.server 8000
```
Ouvrez ensuite [http://localhost:8000](http://localhost:8000) dans votre navigateur.

> [!TIP]
> Si les modifications n'apparaissent pas, faites un rafraîchissement forcé du cache dans votre navigateur avec **Ctrl + Shift + R**.

---

## ⚙️ Configuration
Pour ajouter des joueurs, modifiez la liste `TARGET_WCA_IDS` dans le fichier [src/config.py](file:///c:/Users/fabri/OneDrive%20-%20ac-versailles.fr/IA-IPR/Programmes/Python/VS%20code/WCA/v2/src/config.py).
