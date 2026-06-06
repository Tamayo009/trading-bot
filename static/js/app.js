// =====================================================================
// static/js/app.js - Lógica Central de Transmisión Real-Time y Plotly
// =====================================================================

// Inicializar el cliente de Socket.io (Se conecta automáticamente a http://localhost:5000)
const socket = io.connect(window.location.origin);

let currentPair = 'BTC/USDT';
let currentTimeframe = '1h';
let currentLang = 'en';

// Al conectar con el servidor
socket.on('connect', () => {
    console.log("📡 Conectado al servidor WebSocket de Trading Bot Pro");
    document.querySelector('.status').innerHTML = '<div class="dot" style="background:#3fb950;"></div> En vivo';
    // Inicializar datos estáticos/noticias al arrancar
    loadTrendData();
    loadNews();
    loadMultipair();
});

socket.on('disconnect', () => {
    console.log("❌ Desconectado del servidor");
    document.querySelector('.status').innerHTML = '<div class="dot" style="background:#f85149;"></div> Desconectado';
});

// =====================================================================
// 💥 ESCUCHA DE EVENTOS REAL-TIME (SOCKET.IO)
// =====================================================================
socket.on('update', (data) => {
    // Para no mezclar datos, solo procesamos si corresponde al par seleccionado
    // Nota: El backend emite por defecto BTC/USDT. Si cambias de par en el select, 
    // puedes adaptar tu backend para manejar salas (rooms) o filtrar aquí si la API es multipar.
    
    // 1. Actualizar Bloque Superior de Precios e Indicadores en el Grid
    updateDOMWidgets(data);

    // 2. Renderizar Gráficas Avanzadas con Plotly
    renderCharts(data.candles);
});

// =====================================================================
// 📝 ACTUALIZACIÓN DE COMPONENTES DEL DOM
// =====================================================================
function updateDOMWidgets(data) {
    // Precio y Cambio actual
    document.getElementById('price').innerText = `$${data.current_price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    // Señal de Trading (Cambio de color dinámico según el estado)
    const signalDiv = document.getElementById('signal');
    signalDiv.innerText = data.signal;
    signalDiv.className = `value signal-${data.signal}`; // Mapea clases css si las tienes

    // RSI y Estado
    document.getElementById('rsi').innerText = data.rsi;
    const rsiStatus = document.getElementById('rsi-status');
    if (data.rsi > 70) { rsiStatus.innerText = "⚡ Sobrecompra"; rsiStatus.style.color = "#f85149"; }
    else if (data.rsi < 30) { rsiStatus.innerText = "🟢 Sobreventa"; rsiStatus.style.color = "#3fb950"; }
    else { rsiStatus.innerText = "⏳ Zona Neutral"; rsiStatus.style.color = "#8b949e"; }

    // MACD Histograma/Diferencia
    document.getElementById('macd').innerText = data.macd_diff;
    document.getElementById('macd').style.color = data.macd_diff >= 0 ? "#3fb950" : "#f85149";

    // Barras de Probabilidades Ponderadas
    document.getElementById('buy-prob').innerText = `${data.buy_probability}%`;
    document.getElementById('buy-bar').style.width = `${data.buy_probability}%`;
    document.getElementById('sell-prob').innerText = `${data.sell_probability}%`;
    document.getElementById('sell-bar').style.width = `${data.sell_probability}%`;

    // Timestamp de última actualización
    document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

    // Agregar de forma opcional al historial de señales si hay un cambio de estado claro
    if (data.signal !== "NEUTRAL") {
        appendSignalToTable(data);
    }
}

function appendSignalToTable(data) {
    const tbody = document.getElementById('signals-body');
    // Eliminar el placeholder de "Esperando señales..." si existe
    if (tbody.rows.length === 1 && tbody.rows[0].cells.length === 1) {
        tbody.innerHTML = '';
    }

    // Evitar duplicados seguidos agregando solo si la hora es distinta o la señal cambia
    const row = `<tr>
        <td>${new Date().toLocaleTimeString()}</td>
        <td>${currentPair}</td>
        <td class="signal-${data.signal}">${data.signal}</td>
        <td>$${data.current_price}</td>
        <td>${data.rsi}</td>
    </tr>`;
    tbody.insertAdjacentHTML('afterbegin', row);
}

// =====================================================================
// 📊 CONSTRUCCIÓN DE GRÁFICAS CON PLOTLY
// =====================================================================
function renderCharts(candles) {
    const times = candles.map(c => c.time);
    
    // --- 1. GRÁFICA PRINCIPAL: VELAS JAPONESAS + EMAs ---
    const traceCandles = {
        x: times,
        open: candles.map(c => c.open),
        high: candles.map(c => c.high),
        low: candles.map(c => c.low),
        close: candles.map(c => c.close),
        type: 'candlestick',
        name: currentPair,
        xaxis: 'x',
        yaxis: 'y'
    };

    const traceEMA50 = {
        x: times,
        y: candles.map(c => c.ema_50),
        type: 'scatter',
        mode: 'lines',
        name: 'EMA 50',
        line: { color: '#ffaa00', width: 1.5 }
    };

    const traceEMA200 = {
        x: times,
        y: candles.map(c => c.ema_200),
        type: 'scatter',
        mode: 'lines',
        name: 'EMA 200',
        line: { color: '#ff00ff', width: 1.5 }
    };

    const layoutCandles = {
        dragmode: 'zoom',
        showlegend: true,
        background_color: '#0d1117',
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { r: 40, t: 10, b: 30, l: 50 },
        xaxis: { autorange: true, title: 'Fecha/Hora', gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        yaxis: { autorange: true, title: 'Precio (USD)', gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        font: { color: '#e6edf3' }
    };

    Plotly.newPlot('candlestick-chart', [traceCandles, traceEMA50, traceEMA200], layoutCandles, {responsive: true});

    // --- 2. GRÁFICA DEL RSI (Sub-gráfica inferior) ---
    const traceRSI = {
        x: times,
        y: candles.map(c => c.rsi),
        type: 'scatter',
        mode: 'lines',
        name: 'RSI (14)',
        line: { color: '#58a6ff', width: 1.5 }
    };

    const layoutRSI = {
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        margin: { r: 40, t: 10, b: 30, l: 50 },
        xaxis: { gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        yaxis: { range: [10, 90], gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        shapes: [
            { type: 'line', x0: times[0], y0: 70, x1: times[times.length-1], y1: 70, line: { color: '#f85149', width: 1, dash: 'dash' } },
            { type: 'line', x0: times[0], y0: 30, x1: times[times.length-1], y1: 30, line: { color: '#3fb950', width: 1, dash: 'dash' } }
        ],
        font: { color: '#e6edf3' }
    };
    Plotly.newPlot('rsi-chart', [traceRSI], layoutRSI, {responsive: true});

    // --- 3. GRÁFICA DEL MACD ---
    const traceMACDDiff = {
        x: times,
        y: candles.map(c => c.macd_diff),
        type: 'bar',
        name: 'Histograma',
        marker: { color: candles.map(c => c.macd_diff >= 0 ? '#3fb950' : '#f85149') }
    };

    const layoutMACD = {
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        margin: { r: 40, t: 10, b: 30, l: 50 },
        xaxis: { gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        yaxis: { gridcolor: '#21262d', tickfont: {color: '#8b949e'} },
        font: { color: '#e6edf3' }
    };
    Plotly.newPlot('macd-chart', [traceMACDDiff], layoutMACD, {responsive: true});
}

// =====================================================================
// 🔌 CONTROLES DE LA INTERFAZ (API Rest Fallbacks / Triggers)
// =====================================================================
function changePair() {
    currentPair = document.getElementById('pair-select').value;
    currentTimeframe = document.getElementById('tf-select').value;
    console.log(`🔄 Cambiando visualización a: ${currentPair} (${currentTimeframe})`);
    
    // Cargar datos estáticos iniciales vía Fetch API antes de que el loop de Sockets mande el siguiente tick
    fetch(`/api/data?pair=${currentPair}&tf=${currentTimeframe}`)
        .then(res => res.json())
        .then(data => {
            updateDOMWidgets(data);
            renderCharts(data.candles);
        });
    loadTrendData();
}

function loadTrendData() {
    fetch(`/api/trend?pair=${currentPair}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('trend-direction').innerText = data.trend;
            document.getElementById('trend-direction').style.color = data.trend === 'UP' ? '#3fb950' : '#f85149';
            document.getElementById('trend-change').innerText = `${data.change_24h}%`;
            document.getElementById('trend-change').style.color = data.change_24h >= 0 ? '#3fb950' : '#f85149';
            document.getElementById('trend-high').innerText = `$${data.high_24h.toLocaleString()}`;
            document.getElementById('trend-low').innerText = `$${data.low_24h.toLocaleString()}`;
            document.getElementById('trend-volume').innerText = data.volume_24h.toLocaleString();
        });
}

// =====================================================================
// 📰 ENDPOINT DE NOTICIAS RSS
// =====================================================================
function switchLang(lang) {
    currentLang = lang;
    document.getElementById('btn-en').className = lang === 'en' ? 'active' : '';
    document.getElementById('btn-es').className = lang === 'es' ? 'active' : '';
    loadNews();
}

function loadNews() {
    const container = document.getElementById('news-container');
    container.innerHTML = '<div style="color:#8b949e; text-align:center;">⏳ Cargando noticias RSS...</div>';
    
    fetch(`/api/news?lang=${currentLang}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            if(!data.news || data.news.length === 0) {
                container.innerHTML = '<div style="color:#8b949e; text-align:center;">No hay noticias disponibles.</div>';
                return;
            }
            data.news.forEach(item => {
                const html = `<div style="padding: 10px 0; border-bottom: 1px solid #21262d;">
                    <a href="${item.link}" target="_blank" style="color:#58a6ff; font-size:14px; text-decoration:none; font-weight:600;">${item.title}</a>
                    <div style="font-size:11px; color:#8b949e; margin-top:4px;">📰 ${item.source} | 📅 ${item.date}</div>
                </div>`;
                container.insertAdjacentHTML('beforeend', html);
            });
        });
}

// =====================================================================
// 🪙 MONITOR MULTIPAR
// =====================================================================
function loadMultipair() {
    const container = document.getElementById('multipair-container');
    fetch('/api/multipair')
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            let htmlTable = `<table class="signals-table">
                <thead>
                    <tr><th>Par</th><th>Precio</th><th>Cambio 24h</th><th>RSI</th><th>MACD</th><th>Señal</th></tr>
                </thead>
                <tbody>`;
            data.pairs.forEach(p => {
                htmlTable += `<tr>
                    <td><strong>${p.pair}</strong></td>
                    <td>$${p.price.toLocaleString()}</td>
                    <td style="color:${p.change_24h >= 0 ? '#3fb950' : '#f85149'}">${p.change_24h}%</td>
                    <td>${p.rsi}</td>
                    <td>${p.macd_diff}</td>
                    <td class="signal-${p.signal}">${p.signal}</td>
                </tr>`;
            });
            htmlTable += '</tbody></table>';
            container.innerHTML = htmlTable;
        });
}

// =====================================================================
// 🧠 ENDPOINTS DE MACHINE LEARNING
// =====================================================================
function trainModel() {
    toggleAILoading(true);
    const pair = document.getElementById('ai-pair').value;
    const tf = document.getElementById('ai-tf').value;
    
    fetch(`/api/predict?pair=${pair}&tf=${tf}&action=${train}`)
        .then(res => res.json())
        .then(data => {
            toggleAILoading(false);
            alert(`✅ Modelo entrenado con éxito. Precisión del: ${data.accuracy}%`);
        }).catch(() => toggleAILoading(false));
}

function runPrediction() {
    toggleAILoading(true);
    const pair = document.getElementById('ai-pair').value;
    const tf = document.getElementById('ai-tf').value;
    
    fetch(`/api/predict?pair=${pair}&tf=${tf}&action=predict`)
        .then(res => res.json())
        .then(data => {
            toggleAILoading(false);
            document.getElementById('ai-results').style.display = 'block';
            document.getElementById('ai-prediction').innerText = data.prediction;
            document.getElementById('ai-prediction').className = `value signal-${data.prediction === 'SUBE' ? 'COMPRA' : 'VENTA'}`;
            
            document.getElementById('ai-up').innerText = `${data.prob_up}%`;
            document.getElementById('ai-up-bar').style.width = `${data.prob_up}%`;
            document.getElementById('ai-down').innerText = `${data.prob_down}%`;
            document.getElementById('ai-down-bar').style.width = `${data.prob_down}%`;
            document.getElementById('ai-confidence').innerText = `${data.confidence}%`;
        }).catch(() => toggleAILoading(false));
}

function toggleAILoading(show) {
    document.getElementById('ai-loading').style.display = show ? 'block' : 'none';
    document.getElementById('ai-results').style.display = show ? 'none' : 'block';
}

// =====================================================================
// 📊 BACKTESTING TRIGGER
// =====================================================================
function runBacktest() {
    document.getElementById('bt-loading').style.display = 'block';
    document.getElementById('bt-results').style.display = 'none';
    
    const pair = document.getElementById('bt-pair').value;
    const tf = document.getElementById('bt-tf').value;
    const capital = document.getElementById('bt-capital').value;

    fetch(`/api/backtest?pair=${pair}&tf=${tf}&capital=${capital}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('bt-loading').style.display = 'none';
            document.getElementById('bt-results').style.display = 'block';
            
            document.getElementById('bt-return').innerText = `${data.total_return_pct}%`;
            document.getElementById('bt-return').style.color = data.total_return_pct >= 0 ? '#3fb950' : '#f85149';
            document.getElementById('bt-buyhold').innerText = `${data.buy_and_hold_return_pct}%`;
            document.getElementById('bt-winrate').innerText = `${data.win_rate}%`;
            document.getElementById('bt-trades').innerText = data.total_trades;

            // Graficar curva de Equity si tu backend retorna un historial
            if (data.equity_curve) {
                const traceEquity = {
                    x: data.equity_curve.times,
                    y: data.equity_curve.values,
                    type: 'scatter', mode: 'lines', name: 'Balance $',
                    line: { color: '#58a6ff' }
                };
                Plotly.newPlot('bt-equity-chart', [traceEquity], {
                    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    margin: { r: 20, t: 10, b: 30, l: 50 },
                    xaxis: { gridcolor: '#21262d' }, yaxis: { gridcolor: '#21262d' },
                    font: { color: '#e6edf3' }
                });
            }
        });
}