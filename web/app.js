const DATA_BASE_URL = './data';

let state = {
    personId: null,
    eventId: '333',
    view: 'timeline', // timeline, rounds, map
    chartInstance: null,
    mapInstance: null,
    mapLayer: null,
    currentData: null,
    competitionsIndex: null
};

// --- INIT ---

async function init() {
    // Fix viewport height on mobile (addresses bar issue)
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    // Init Chart First
    state.chartInstance = echarts.init(document.getElementById('main-chart'));
    state.chartInstance.on('click', onChartClick);
    window.addEventListener('resize', () => {
        state.chartInstance.resize();
        if (state.mapInstance) state.mapInstance.invalidateSize();
    });

    await loadPersonIndex();
    await loadCompetitionsIndex();

    // UI Event Listeners
    document.getElementById('user-select').addEventListener('change', (e) => {
        state.personId = e.target.value;
        // Update event dropdown for this person
        const selectedOption = e.target.options[e.target.selectedIndex];
        const events = JSON.parse(selectedOption.dataset.events || '[]');
        updateEventDropdown(events);
        refreshView();
    });

    document.getElementById('event-select').addEventListener('change', (e) => {
        state.eventId = e.target.value;
        refreshView();
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.view = e.target.dataset.view;
            refreshView();
        });
    });

    // Select first user automatically if list populated
}

async function loadPersonIndex() {
    try {
        const res = await fetch(`${DATA_BASE_URL}/index_persons.json`);
        const persons = await res.json();

        const userSelect = document.getElementById('user-select');
        userSelect.innerHTML = '';

        persons.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.personId;
            opt.textContent = `${p.name} (${p.personId})`;
            opt.dataset.events = JSON.stringify(p.events); // Store events for later
            userSelect.appendChild(opt);
        });

        if (persons.length > 0) {
            state.personId = persons[0].personId;
            userSelect.value = state.personId;
            updateEventDropdown(persons[0].events);
            refreshView();
        }
    } catch (e) {
        console.error("Failed to load person index", e);
    }
}

function updateEventDropdown(events) {
    // Safety check in case events is undefined (old JSON format)
    if (!events || !Array.isArray(events)) {
        events = ['333']; // Default to 3x3x3
    }

    const eventNames = {
        '333': '3x3x3 Cube',
        '222': '2x2x2 Cube',
        '444': '4x4x4 Cube',
        '555': '5x5x5 Cube',
        '666': '6x6x6 Cube',
        '777': '7x7x7 Cube',
        '333bf': '3x3 Blindfolded',
        '333fm': '3x3 Fewest Moves',
        '333oh': '3x3 One-Handed',
        'clock': 'Clock',
        'minx': 'Megaminx',
        'pyram': 'Pyraminx',
        'skewb': 'Skewb',
        'sq1': 'Square-1',
        '444bf': '4x4 Blindfolded',
        '555bf': '5x5 Blindfolded',
        '333mbf': '3x3 Multiple Blindfolded'
    };

    const eventSelect = document.getElementById('event-select');
    eventSelect.innerHTML = '';

    events.forEach(eventId => {
        const opt = document.createElement('option');
        opt.value = eventId;
        opt.textContent = eventNames[eventId] || eventId;
        eventSelect.appendChild(opt);
    });

    // Set selected event: preserve current if available, otherwise first of list
    if (events.length > 0) {
        if (!events.includes(state.eventId)) {
            state.eventId = events[0];
        }
        eventSelect.value = state.eventId;
    }
}

async function loadCompetitionsIndex() {
    try {
        const res = await fetch(`${DATA_BASE_URL}/index_competitions.json`);
        state.competitionsIndex = await res.json();
    } catch (e) {
        console.error("Failed to load comps index", e);
    }
}

function refreshView() {
    // Handling Visibility
    const mapContainer = document.getElementById('map-container');
    const chartContainer = document.getElementById('chart-container');

    if (state.view === 'map') {
        mapContainer.style.display = 'block';
        chartContainer.style.display = 'none';
        initMap(); // Ensure map is init
        loadMapData();
    } else {
        mapContainer.style.display = 'none';
        chartContainer.style.display = 'block';
        loadStatsData();
    }

    // Hide sidebar on view switch
    toggleSidebar(false);
}

// --- STATS LOGIC ---

async function loadStatsData() {
    if (!state.personId) return;

    state.chartInstance.showLoading();

    const url = `${DATA_BASE_URL}/stats/${state.personId}/${state.eventId}/${state.view}.json`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("File not found (maybe no results for this event?)");
        const data = await res.json();
        state.currentData = data;

        if (state.view === 'timeline') {
            renderTimeline(data);
        } else {
            renderRounds(data);
        }
    } catch (e) {
        console.warn(e);
        state.chartInstance.hideLoading();
        state.chartInstance.setOption({
            title: { text: 'Aucune donnée disponible pour cet événement', left: 'center', top: 'center', textStyle: { color: '#666' } },
            series: [], xAxis: {}, yAxis: {}
        }, true);
    }
}

function renderTimeline(data) {
    state.chartInstance.hideLoading();
    const points = data.points;

    // Format data as [date, value] pairs for time axis
    const avgs = points.map(p => [p.dateEnd, p.bestAvgCs ? p.bestAvgCs / 100 : null]);
    const singles = points.map(p => [p.dateEnd, p.bestSingleCs / 100]);

    const option = {
        backgroundColor: '#1e1e1e',
        tooltip: {
            trigger: 'axis',
            confine: true, // Keep inside chart on mobile
            backgroundColor: 'rgba(30,30,30,0.9)',
            borderColor: '#333',
            textStyle: { color: '#eee' },
            formatter: (params) => {
                const idx = params[0].dataIndex;
                const p = points[idx];

                let roundsHtml = p.rounds.map(r =>
                    `<div style="display:flex; justify-content:space-between; gap:15px; font-size:12px; border-top:1px solid #333; padding-top:2px; margin-top:2px;">
                        <span>${r.name}</span>
                        <span>S: <b>${r.single}</b></span>
                        <span>A: <b>${r.avg}</b></span>
                        <span>#<b>${r.pos}</b></span>
                    </div>`
                ).join('');

                return `<div style="min-width:200px">
                            <b style="color:#64b5f6">${p.compName}</b><br/>
                            ${roundsHtml}
                        </div>`;
            }
        },
        grid: { left: 50, right: 20, top: 40, bottom: window.innerWidth <= 768 ? 30 : 60 },
        dataZoom: window.innerWidth <= 768 ? [
            { type: 'inside' }
        ] : [
            { type: 'inside' },
            { type: 'slider', bottom: 10, borderColor: '#333', textStyle: { color: '#888' } }
        ],
        xAxis: {
            type: 'time', // Real time axis
            axisLine: { lineStyle: { color: '#444' } },
            axisLabel: {
                color: '#888',
                formatter: (value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getFullYear()}`;
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#444' } },
            splitLine: { lineStyle: { color: '#333' } },
            axisLabel: { color: '#888' },
            scale: true
        },
        series: [
            {
                name: 'Average',
                type: 'line',
                data: avgs,
                itemStyle: { color: '#64b5f6' },
                lineStyle: { width: 3 },
                symbolSize: 8,
                connectNulls: true
            },
            {
                name: 'Single',
                type: 'line',
                data: singles,
                itemStyle: { color: 'rgba(255, 255, 255, 0.3)' },
                lineStyle: { type: 'dashed', width: 1 },
                symbolSize: 4
            }
        ]
    };
    state.chartInstance.setOption(option, true);
}

function renderRounds(data) {
    state.chartInstance.hideLoading();
    const rounds = data.rounds;

    // Calculate global min/max for Y axis scaling if needed

    const xLabels = rounds.map((r, i) => `R${i + 1}`);
    const avgs = rounds.map((r, i) => [i, r.avgCs > 0 ? r.avgCs / 100 : null]);

    // Flatten attempts for scatter with jitter
    const attemptsData = [];
    rounds.forEach((r, rIdx) => {
        const numAttempts = r.attemptsCs.length;
        r.attemptsCs.forEach((val, i) => {
            if (val > 0) {
                // Calculate jitter: spread points around the center rIdx
                // e.g. for 5 attempts spread between -0.2 and 0.2
                let offset = 0;
                if (numAttempts > 1) {
                    offset = (i - (numAttempts - 1) / 2) * 0.08;
                }
                attemptsData.push({
                    value: [rIdx + offset, val / 100],
                    roundIndex: rIdx,
                    attemptIndex: i
                });
            }
        });
    });

    const option = {
        backgroundColor: '#1e1e1e',
        tooltip: {
            trigger: 'item',
            confine: true, // Keep inside chart on mobile
            backgroundColor: 'rgba(30,30,30,0.9)',
            borderColor: '#333',
            textStyle: { color: '#eee' },
            formatter: (params) => {
                if (params.seriesName === 'Attempts') {
                    const data = params.data;
                    const r = rounds[data.roundIndex];
                    const time = params.value[1].toFixed(2);
                    return `<b>${r.compName}</b><br/>
                            ${r.roundName}<br/>
                            Solve n°${data.attemptIndex + 1}: <b>${time}</b>`
                } else if (params.seriesName === 'Average') {
                    const rIdx = params.data[0];
                    const r = rounds[rIdx];
                    if (!r) return '';
                    return `<b>${r.compName}</b><br/>
                            ${r.roundName}<br/>
                            AVG: <b>${params.value[1].toFixed(2)}</b><br/>
                            Rank: <b>${r.pos}</b>`;
                }
            }
        },
        grid: { left: 50, right: 20, top: 40, bottom: window.innerWidth <= 768 ? 30 : 60 },
        dataZoom: window.innerWidth <= 768 ? [
            { type: 'inside', xAxisIndex: 0 }
        ] : [
            { type: 'inside', xAxisIndex: 0 },
            { type: 'slider', bottom: 10 }
        ],
        xAxis: {
            type: 'value',
            minInterval: 1,
            maxInterval: 1,
            axisLabel: {
                formatter: val => `Round ${parseInt(val) + 1}`
            }
        },
        yAxis: {
            type: 'value',
            scale: true,
            splitLine: { lineStyle: { color: '#333' } }
        },
        series: [
            {
                name: 'Attempts',
                type: 'scatter',
                data: attemptsData,
                itemStyle: {
                    color: '#64b5f6', // Bright Blue
                    opacity: 0.8,
                    borderColor: '#fff',
                    borderWidth: 1
                },
                symbolSize: 8 // Bigger dots
            },
            {
                name: 'Average',
                type: 'line',
                data: avgs,
                itemStyle: { color: '#66bb6a' }, // Green
                lineStyle: { width: 3, opacity: 0.6 },
                symbolSize: 12,
                connectNulls: false,
                z: 10
            }
        ]
    };
    state.chartInstance.setOption(option, true);
}

function onChartClick(params) {
    const idx = params.dataIndex; // If series is line, dataIndex maps to array
    // Note: Scatter click might give different index logic (the point index)
    // For timeline: array index.
    // For rounds: X value usually.

    let item = null;

    if (state.view === 'timeline') {
        item = state.currentData.points[idx];
        showSidebar(item, 'timeline');
    } else if (state.view === 'rounds') {
        // For scatter/line in rounds view, the X value corresponds to the round index
        const roundIdx = params.value[0];
        item = state.currentData.rounds[roundIdx];
        showSidebar(item, 'rounds');
    }
}


// --- MAP LOGIC ---

function initMap() {
    if (state.mapInstance) return;

    state.mapInstance = L.map('map-view').setView([46.603354, 1.888334], 5); // France center default

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(state.mapInstance);
}

async function loadMapData() {
    try {
        const res = await fetch(`${DATA_BASE_URL}/map_competitions.geojson`);
        const geojson = await res.json();

        if (state.mapLayer) state.mapInstance.removeLayer(state.mapLayer);

        state.mapLayer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: "#64b5f6",
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(`
                    <b>${p.name}</b><br>
                    ${p.city}<br>
                    ${p.dateEnd}<br>
                    Participants: ${p.participants.join(', ')}
                `);
            }
        }).addTo(state.mapInstance);

        // Fit bounds
        state.mapInstance.fitBounds(state.mapLayer.getBounds());
    } catch (e) {
        console.error("Map data error", e);
    }
}


// --- SIDEBAR ---

function toggleSidebar(force) {
    const el = document.getElementById('details-panel');
    if (force !== undefined) {
        force ? el.classList.remove('closed') : el.classList.add('closed');
    } else {
        el.classList.toggle('closed');
    }
}

function showSidebar(item, mode) {
    const content = document.getElementById('panel-content');
    const title = document.getElementById('panel-title');
    toggleSidebar(true);

    if (mode === 'timeline') {
        title.textContent = item.compName;
        content.innerHTML = `
            <div class="stat-group">
                <div class="stat-label">Date</div>
                <div>${item.dateEnd}</div>
            </div>
            <div class="stat-group">
                <div class="stat-label">Best Single</div>
                <div class="stat-value ${item.isPRSingle ? 'pr' : ''}">
                    ${item.bestSingleText}
                    ${item.isPRSingle ? '<span class="pr-badge">PR</span>' : ''}
                </div>
            </div>
            <div class="stat-group">
                <div class="stat-label">Best Average</div>
                <div class="stat-value ${item.isPRAvg ? 'pr' : ''}">
                    ${item.bestAvgText}
                    ${item.isPRAvg ? '<span class="pr-badge">PR</span>' : ''}
                </div>
            </div>
            <div class="stat-group">
                <div class="stat-label">Rounds Joués</div>
                <div>${item.roundsCount}</div>
            </div>
        `;
    } else {
        title.textContent = 'Détail du Round';
        content.innerHTML = `
            <div class="stat-group">
                <div class="stat-label">Compétition</div>
                <div><b>${item.compName}</b><br>${item.date}</div>
            </div>
            <div class="stat-group">
                <div class="stat-label">Résultats</div>
                <ul class="attempts-list">
                    ${item.attemptsText.map((t, i) => `
                        <li class="attempt-row">
                            <span class="attempt-n">${i + 1}</span>
                            <span>${t}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div class="stat-group">
                <div class="stat-label">Moyenne</div>
                <div class="stat-value">${item.avgText}</div>
            </div>
             <div class="stat-group">
                <div class="stat-label">Meilleur</div>
                <div class="stat-value">${item.bestText}</div>
            </div>
        `;
    }
}

// Start
init();
