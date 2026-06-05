# 🐛 Guide de Débogage et Erreurs Courantes

Ce document décrit les erreurs communes rencontrées lors de l'exécution du pipeline et comment les résoudre.

---

## 1. **Erreur : Exit Code 1 dans GitHub Actions**

### 🔴 Symptôme
- L'action GitHub Actions se termine avec **Status: Failure** (code d'erreur 1)
- Sous **Annotations**, vous voyez : `Process completed with exit code 1`
- Les autres fichiers TSV sont correctement téléchargés, mais le pipeline s'arrête

### 🔍 Cause Probable
**Erreur d'unpacking de variables Python**

Cela se produit généralement quand une fonction retourne un nombre différent de valeurs que ce qui est attendu lors de l'unpacking.

Exemple :
```python
# ❌ MAUVAIS - fonction retourne 5 valeurs
def load_data():
    try:
        return a, b, c, d, e
    except Exception:
        return None, None, None, None, None  # ← 5 None au lieu de 6!

# Puis dans le code principal
results, attempts, comps, events, persons, round_types = load_data()  # ❌ Crash!
# ValueError: not enough values to unpack (expected 6, got 5)
```

### ✅ Solution
1. Vérifiez le nombre de variables attendues lors de l'unpacking
2. Assurez-vous que la fonction retourne **exactement le même nombre** de valeurs en tous les cas (try, except, etc.)

**Exemple corrigé :**
```python
# ✅ BON - même nombre de valeurs retournées partout
def load_data():
    try:
        return a, b, c, d, e, f  # 6 valeurs
    except Exception:
        return None, None, None, None, None, None  # 6 None
```

### 📝 Checklist pour déboguer
- [ ] Compter le nombre de variables dans l'assignation (ex: `a, b, c, d, e, f = func()`)
- [ ] Compter le nombre de valeurs retournées dans chaque branche de la fonction (try, except, if/else)
- [ ] Vérifier que les nombres correspondent

---

## 2. **Erreur : FileNotFoundError - Cache not found**

### 🔴 Symptôme
- Les scripts s'exécutent mais génèrent peu ou pas de données
- Logs montrent : `Cache not found. Run 02_extract_wca_v2.py first.`

### 🔍 Cause Probable
Le script `02_extract_wca_v2.py` n'a pas pu générer les fichiers cache (`.parquet`).

Raisons possibles :
- Le script `01_fetch_data.py` n'a pas téléchargé les données (API WCA down ou timeout réseau)
- Le fichier `results.tsv` ne s'est pas extracté correctement
- L'espace disque est insuffisant

### ✅ Solution
1. Vérifiez les logs du workflow sur GitHub Actions
2. Regardez l'étape "Run Data Pipeline" pour voir quel script exact a échoué
3. Lancez manuellement les scripts localement pour reproduire le problème:
   ```powershell
   python src/01_fetch_data.py
   python src/02_extract_wca_v2.py
   ```
4. Vérifiez que le dossier `data/` contient les fichiers `.tsv` attendus

---

## 3. **Dépréciassion Node.js 20 dans GitHub Actions**

### 🟠 Symptôme (Avertissement)
- L'action affiche un avertissement (jaune) :
  ```
  Node.js 20 actions are deprecated...
  actions/checkout@4, actions/setup-python@5
  ```

### 🔍 Cause
GitHub supprime le support de Node.js 20 (fin le 16 septembre 2026).
Les versions des actions utilisées ne supportent pas encore Node.js 24.

### ✅ Solution
Mettez à jour les versions des actions dans `.github/workflows/update.yml` :

```yaml
# Avant (deprecated)
- uses: actions/checkout@v4
- uses: actions/setup-python@v5

# Après (à jour)
- uses: actions/checkout@v4  # Vérifiez la dernière version disponible
- uses: actions/setup-python@v5  # Idem
```

Consultez :
- https://github.com/actions/checkout (releases)
- https://github.com/actions/setup-python (releases)

---

## 4. **Erreur : API WCA Indisponible**

### 🔴 Symptôme
- Le log montre : `Failed to fetch metadata: Connection refused` ou timeout
- Le script `01_fetch_data.py` ne télécharge rien

### 🔍 Cause
- L'API publique de la WCA est temporairement down
- Problème réseau ou firewall

### ✅ Solution
- Attendez que l'API soit disponible (vérifiez https://www.worldcubeassociation.org)
- Lancez manuellement l'action depuis GitHub (onglet **Actions** → Re-run)

---

## 5. **Erreur : Données Corrompues ou Vides**

### 🔴 Symptôme
- Les fichiers `.parquet` ou `.json` sont créés mais vides
- Les statistiques ne s'affichent pas sur le site

### 🔍 Cause
- Aucun résultat ne correspond aux IDs WCA configurés dans `config.py`
- Les noms de colonnes dans les fichiers TSV ont changé

### ✅ Solution
1. Vérifiez que les IDs WCA dans `src/config.py` sont valides et à jour
2. Lancez localement et vérifiez les logs :
   ```powershell
   python src/02_extract_wca_v2.py
   # Devrait afficher : "Found X results matching target IDs"
   ```
3. Si X = 0, vérifiez les IDs WCA

---

## 6. **Erreur : Permissions OneDrive/Fichiers Verrouillés**

### 🔴 Symptôme (Lors d'exécution locale)
```
PermissionError: [Errno 13] Permission denied: 'data/results.tsv'
```

### 🔍 Cause
- Fichier ouvert dans Excel ou un autre programme
- OneDrive en train de synchroniser
- Antivirus bloquant l'accès

### ✅ Solution
1. Fermez tous les fichiers du projet
2. Attendez que OneDrive finisse de syncer (pas de barre de progression dans la notification)
3. Relancez le script

---

## 📋 Checklist de Débogage Générale

Quand une action échoue :

- [ ] Allez dans **Actions** → Cliquez sur la run échouée
- [ ] Regardez la section **Annotations** (erreurs et avertissements)
- [ ] Consultez les logs complets de l'étape qui a échoué
- [ ] Reproduisez localement si possible : `python src/XX_script.py`
- [ ] Vérifiez les fichiers de configuration (`config.py`, `requirements.txt`)
- [ ] Vérifiez que les données sources existent (dossier `data/`)

---

## 🔧 Commandes Utiles pour le Débogage

```powershell
# Exécuter un script isolé
python src/01_fetch_data.py

# Vérifier les fichiers générés
ls data/
ls out/

# Vérifier les logs complets
git log --oneline -10  # Voir les commits récents

# Lancer le workflow manuellement depuis GitHub
# → Actions → (sélectionnez le workflow) → "Run workflow"
```

---

## 💡 Prévention

- ✅ Testez localement avant de pousser
- ✅ Vérifiez les dépendances dans `requirements.txt`
- ✅ Maintenez les versions des actions à jour
- ✅ Documentez les changements dans les commit messages
- ✅ Surveillez les avertissements GitHub Actions (section **Annotations**)
