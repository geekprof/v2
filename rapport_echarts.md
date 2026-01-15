# Rapport d'intégration du moteur de graphiques (Apache ECharts)

Ce rapport détaille la mise en œuvre du moteur d'affichage des courbes utilisé dans le projet WCA Analytics, basé sur **Apache ECharts**. Ce moteur est particulièrement adapté pour des applications de suivi de comptes bancaires grâce à sa gestion native des axes temporels et son interactivité.

## 1. Stack Technique
- **Bibliothèque** : [Apache ECharts](https://echarts.apache.org/) (version 5.4.3+)
- **Format** : Canvas (plus performant que SVG pour un grand nombre de points)
- **Intégration** : via CDN ou npm.
  ```html
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  ```

## 2. Structure du Graphique "Timeline"
Le graphique utilisé pour le suivi temporel (timeline) est configuré comme suit :

### Initialisation
```javascript
const chartDom = document.getElementById('main-chart');
const myChart = echarts.init(chartDom, 'dark'); // Mode sombre activé
```

### Configuration Clé (Options)
Les points essentiels pour un suivi de compte bancaire :

```javascript
const option = {
    backgroundColor: '#111827', // Pour un look premium "Fintech"
    tooltip: {
        trigger: 'axis',
        formatter: (params) => { /* Personnalisation du texte de survol */ }
    },
    xAxis: {
        type: 'time', // INDISPENSABLE : gère automatiquement les écarts de dates
        axisLabel: {
            formatter: (value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
            }
        }
    },
    yAxis: {
        type: 'value',
        scale: true, // Évite de commencer à 0 si les valeurs sont proches
        axisLabel: {
            formatter: '{value} €' // Formatage monétaire
        }
    },
    dataZoom: [
        { type: 'inside' }, // Zoom à la molette/tactile
        { type: 'slider' }  // Barre de navigation en bas
    ],
    series: [{
        name: 'Solde',
        type: 'line',
        smooth: true,   // Courbes lissées pour une esthétique moderne
        areaStyle: {    // Effet de dégradé sous la courbe
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' }
            ])
        },
        data: [
            ['2025-01-01', 1250.50],
            ['2025-01-05', 1100.20],
            // ... [date, valeur]
        ]
    }]
};
```

## 3. Avantages pour le Suivi Bancaire
1. **Axe Temporel intelligent** : Même si vous n'avez pas de transaction tous les jours, ECharts respecte l'échelle du temps réelle (contrairement aux axes de type "category").
2. **DataZoom** : Permet de voir facilement une année entière puis de zoomer sur une semaine précise d'un simple geste.
3. **Performance** : Supporte des milliers de transactions sans ralentissement.
4. **Tooltips complexes** : On peut afficher les détails de la transaction (libellé, catégorie) directement au survol du point.

## 4. Conseils pour le Développeur
- **Responsive** : Utiliser `window.addEventListener('resize', () => myChart.resize());` pour que le graphique s'adapte aux mobiles.
- **Thémage** : ECharts permet de créer des thèmes JSON complets pour correspondre exactement à la charte graphique de l'application bancaire.
- **Grille** : Ajuster `grid: { left: '10%', right: '5%', bottom: '15%' }` pour optimiser l'espace sur petit écran.
