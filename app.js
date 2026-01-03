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
            const view = e.currentTarget.dataset.view;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.view = view;
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
    const historyView = document.getElementById('full-history-view');
    const eventSelect = document.getElementById('event-select');

    // Show/Hide event selector (only useful for charts)
    eventSelect.style.display = (state.view === 'timeline' || state.view === 'rounds') ? 'block' : 'none';

    if (state.view === 'map') {
        mapContainer.style.display = 'block';
        chartContainer.style.display = 'none';
        historyView.style.display = 'none';
        initMap(); // Ensure map is init
        loadMapData();
    } else if (state.view === 'full') {
        mapContainer.style.display = 'none';
        chartContainer.style.display = 'none';
        historyView.style.display = 'block';
        loadFullHistory();
    } else {
        mapContainer.style.display = 'none';
        chartContainer.style.display = 'block';
        historyView.style.display = 'none';
        loadStatsData();
    }

}

// --- STATS LOGIC ---

async function loadStatsData() {
    if (!state.personId) return;

    state.chartInstance.showLoading();

    const url = `${DATA_BASE_URL}/stats/${state.personId}/${state.eventId}/${state.view}.json`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();
        state.currentData = data;

        if (state.view === 'timeline') {
            renderTimeline(data);
        } else if (state.view === 'rounds') {
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

async function loadFullHistory() {
    if (!state.personId) return;
    const container = document.getElementById('history-content');
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #555;">Chargement de l\'historique...</div>';

    try {
        const res = await fetch(`${DATA_BASE_URL}/stats/${state.personId}/full.json`);
        const data = await res.json();
        renderFullHistory(data);
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef5350;">Erreur lors du chargement de l\'historique.</div>';
    }
}

function renderFullHistory(data) {
    const container = document.getElementById('history-content');
    container.innerHTML = '';

    const eventNames = {
        '333': '3x3x3 Cube', '222': '2x2x2 Cube', '444': '4x4x4 Cube', '555': '5x5x5 Cube',
        '666': '6x6x6 Cube', '777': '7x7x7 Cube', '333bf': '3x3 Blindfolded', '333fm': '3x3 Fewest Moves',
        '333oh': '3x3 One-Handed', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
        'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4 Blindfolded', '555bf': '5x5 Blindfolded',
        '333mbf': '3x3 Multiple Blindfolded'
    };

    data.history.forEach(comp => {
        const compCard = document.createElement('div');
        compCard.className = 'comp-card';

        let eventsHtml = comp.events.map(ev => {
            const roundsHtml = ev.rounds.map(r => `
                <tr>
                    <td class="td-name">
                        <div class="round-label-text">${r.name}</div>
                        <div class="mobile-solves">${r.attempts.join(', ')}</div>
                    </td>
                    <td class="td-solves">${r.attempts.join(', ')}</td>
                    <td class="td-avg">${r.avg}</td>
                    <td class="td-pos">#${r.pos}</td>
                </tr>
            `).join('');

            return `
                <div class="event-block">
                    <div class="event-title-row">
                        <div class="event-label">
                            <span style="font-size:1.2rem">${getEventEmoji(ev.eventId)}</span> ${eventNames[ev.eventId] || ev.eventId}
                        </div>
                        <div class="event-bests">
                            Best Single: <b>${ev.bestSingle}</b> | Best Avg: <b>${ev.bestAvg}</b>
                        </div>
                    </div>
                    <table class="round-table">
                        <thead>
                            <tr>
                                <th>Round</th>
                                <th class="hide-mobile">Solves</th>
                                <th style="text-align:right">Average</th>
                                <th style="text-align:right">Rank</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${roundsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        compCard.innerHTML = `
            <div class="comp-header">
                <h3>${comp.name}</h3>
                <div class="comp-meta">
                    <span>📅 ${comp.date}</span>
                    <span>📍 ${comp.city}</span>
                </div>
            </div>
            <div class="comp-body">
                ${eventsHtml}
            </div>
        `;
        container.appendChild(compCard);
    });
}

function getEventEmoji(id) {
    const emojis = {
        '333': '🧊', '222': '🧊', '444': '🧊', '555': '🧊', '666': '🧊', '777': '🧊',
        'clock': '🕒', 'minx': '⚽', 'pyram': '🔺', 'skewb': '💎', 'sq1': '⬜', '333oh': '🖐️', '333bf': '🙈'
    };
    return emojis[id] || '🧩';
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




// Start
init();
