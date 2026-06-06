const socket = io();
let signalHistory = [];
let currentPair = 'BTC/USDT';
let lastPrice = null;
let lastSignal = 'NEUTRAL';

// ─── AUDIO ───────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'BUY') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'SELL') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'ALERT') {
        [0, 0.3].forEach(function(delay) {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.frequency.setValueAtTime(660, audioCtx.currentTime + delay);
            g.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
            g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.2);
            o.start(audioCtx.currentTime + delay);
            o.stop(audioCtx.currentTime + delay + 0.2);
        });
    }
}

function checkSignalSound(signal) {
    if (signal !== lastSignal) {
        if (signal === 'COMPRA') playSound('BUY');
        else if (signal === 'VENTA') playSound('SELL');
        lastSignal = signal;
    }
}

// ─── CAMBIO DE PAR / TIMEFRAME ───────────────────────────────────────────────
function changePair() {
    currentPair = document.getElementById('pair-select').value;
    var tf = document.getElementById('tf-select').value;
    fetchData(currentPair, tf);
}

// ─── FETCH DE DATOS ──────────────────────────────────────────────────────────
function fetchData(pair, tf) {
    fetch('/api/data?pair=' + encodeURIComponent(pair) + '&tf=' + tf)
        .then(function(r) { return r.json(); })
        .then(function(data) { updateDashboard(data); })
        .catch(function(err) { console.error('Error fetching data:', err); });
}

// ─── ACTUALIZAR DASHBOARD ────────────────────────────────────────────────────
function updateDashboard(data) {
    updatePrice(data.current_price);
    updateSignal(data.signal);
    updateRSI(data.rsi);
    updateMACD(data.macd_diff);
    updateProbabilities(data.buy_probability, data.sell_probability);
    updateTime();
    addToHistory(data);
    renderCharts(data.candles, data.buy_probability, data.sell_probability);
}

function updatePrice(price) {
    var el = document.getElementById('price');
    el.textContent = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2 });

    el.classList.remove('price-flash');
    void el.offsetWidth;
    el.classList.add('price-flash');

    if (lastPrice !== null) {
        var diff   = price - lastPrice;
        var pct    = ((diff / lastPrice) * 100).toFixed(2);
        var change = document.getElementById('price-change');
        change.textContent = (diff >= 0 ? '▲' : '▼') + ' ' + Math.abs(pct) + '%';
        change.style.color = diff >= 0 ? '#3fb950' : '#f85149';
    }
    lastPrice = price;
}

function updateSignal(signal) {
    var el = document.getElementById('signal');
    el.textContent = signal;
    el.className   = 'value signal-' + signal;
    checkSignalSound(signal);
}

function updateRSI(rsi) {
    document.getElementById('rsi').textContent = rsi;
    var status = document.getElementById('rsi-status');
    if (rsi < 30) {
        status.textContent = '⚠️ Sobrevendido';
        status.style.color = '#3fb950';
    } else if (rsi > 70) {
        status.textContent = '⚠️ Sobrecomprado';
        status.style.color = '#f85149';
    } else {
        status.textContent = 'Zona neutral';
        status.style.color = '#8b949e';
    }
}

function updateMACD(macd_diff) {
    document.getElementById('macd').textContent = macd_diff;
}

function updateProbabilities(buyProb, sellProb) {
    document.getElementById('buy-prob').textContent  = buyProb + '%';
    document.getElementById('sell-prob').textContent = sellProb + '%';
    document.getElementById('buy-bar').style.width   = buyProb + '%';
    document.getElementById('sell-bar').style.width  = sellProb + '%';
}

function updateTime() {
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
}

// ─── HISTORIAL DE SEÑALES ────────────────────────────────────────────────────
function addToHistory(data) {
    if (data.signal === 'NEUTRAL') return;
    signalHistory.unshift({
        time:   new Date().toLocaleTimeString(),
        pair:   currentPair,
        signal: data.signal,
        price:  data.current_price,
        rsi:    data.rsi
    });
    if (signalHistory.length > 10) signalHistory.pop();
    updateSignalTable();
}

function updateSignalTable() {
    var tbody = document.getElementById('signals-body');
    if (signalHistory.length === 0) return;
    tbody.innerHTML = signalHistory.map(function(s) {
        return '<tr>' +
            '<td style="color:#8b949e">' + s.time + '</td>' +
            '<td>' + s.pair + '</td>' +
            '<td><span class="badge badge-' + (s.signal === 'COMPRA' ? 'buy' : 'sell') + '">' + s.signal + '</span></td>' +
            '<td>$' + s.price.toLocaleString() + '</td>' +
            '<td>' + s.rsi + '</td>' +
            '</tr>';
    }).join('');
}

// ─── LAYOUT BASE ─────────────────────────────────────────────────────────────
var layoutBase = {
    paper_bgcolor: '#161b22',
    plot_bgcolor:  '#161b22',
    font:  { color: '#e6edf3', size: 11 },
    xaxis: { gridcolor: '#21262d', showgrid: true },
    yaxis: { gridcolor: '#21262d', showgrid: true },
    margin: { t: 36, r: 16, b: 36, l: 60 },
    legend: { bgcolor: 'transparent' },
    showlegend: true
};

// ─── GRÁFICOS ─────────────────────────────────────────────────────────────────
function renderCharts(candles, buyProb, sellProb) {
    var times  = candles.map(function(c) { return c.time; });
    var closes = candles.map(function(c) { return c.close; });
    renderCandlestick(candles, times, closes);
    renderRSI(candles, times);
    renderMACD(candles, times);
    renderGauge(buyProb);
}

function renderCandlestick(candles, times, closes) {
    var bbMid = closes.map(function(_, i) {
        if (i < 19) return null;
        var slice = closes.slice(i - 19, i + 1);
        return slice.reduce(function(a, b) { return a + b; }) / 20;
    });

    var bbStd = closes.map(function(_, i) {
        if (i < 19) return null;
        var slice = closes.slice(i - 19, i + 1);
        var mean  = slice.reduce(function(a, b) { return a + b; }) / 20;
        return Math.sqrt(slice.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / 20);
    });

    var layout = {
        autosize: true,
        paper_bgcolor: '#161b22',
        plot_bgcolor:  '#161b22',
        font:  { color: '#e6edf3', size: 11 },
        margin: { t: 36, r: 16, b: 36, l: 60 },
        legend: { bgcolor: 'transparent' },
        showlegend: true,
        title: { text: currentPair + ' — Velas + BB + EMA + Volumen', font: { color: '#8b949e', size: 12 } },
        xaxis:  { gridcolor: '#21262d', rangeslider: { visible: false } },
        yaxis:  { gridcolor: '#21262d', domain: [0.3, 1], title: { text: 'Precio', font: { color: '#8b949e', size: 10 } } },
        yaxis2: { gridcolor: '#21262d', domain: [0, 0.25], showgrid: true, tickformat: '.2s', title: { text: 'Volumen', font: { color: '#8b949e', size: 10 } } },
        height: 500
    };

    Plotly.newPlot('candlestick-chart', [
        {
            type: 'candlestick', x: times,
            open:  candles.map(function(c) { return c.open; }),
            high:  candles.map(function(c) { return c.high; }),
            low:   candles.map(function(c) { return c.low; }),
            close: candles.map(function(c) { return c.close; }),
            increasing: { line: { color: '#3fb950' }, fillcolor: '#3fb950' },
            decreasing: { line: { color: '#f85149' }, fillcolor: '#f85149' },
            name: currentPair, yaxis: 'y'
        },
        {
            x: times, y: bbMid,
            type: 'scatter', line: { color: '#58a6ff', width: 1 },
            name: 'BB Media', yaxis: 'y'
        },
        {
            x: times, y: bbMid.map(function(m, i) { return m ? m + 2 * bbStd[i] : null; }),
            type: 'scatter', line: { color: '#8b949e', width: 1, dash: 'dot' },
            name: 'BB Superior', yaxis: 'y'
        },
        {
            x: times, y: bbMid.map(function(m, i) { return m ? m - 2 * bbStd[i] : null; }),
            type: 'scatter', line: { color: '#8b949e', width: 1, dash: 'dot' },
            name: 'BB Inferior', yaxis: 'y',
            fill: 'tonexty', fillcolor: 'rgba(88,166,255,0.05)'
        },
        {
            x: times,
            y: candles.map(function(c) { return c.ema_50; }),
            type: 'scatter', line: { color: '#f0883e', width: 1.5 },
            name: 'EMA 50', yaxis: 'y'
        },
        {
            x: times,
            y: candles.map(function(c) { return c.ema_200; }),
            type: 'scatter', line: { color: '#d29922', width: 1.5 },
            name: 'EMA 200', yaxis: 'y'
        },
        {
            x: times,
            y: candles.map(function(c) { return c.volume; }),
            type: 'bar', name: 'Volumen', yaxis: 'y2',
            marker: {
                color: candles.map(function(c, i) {
                    if (i === 0) return 'rgba(88,166,255,0.4)';
                    return c.close >= c.open ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)';
                })
            }
        }
    ], layout, { responsive: true });
}

function renderRSI(candles, times) {
    var layout = {
        autosize: true,
        paper_bgcolor: '#161b22', plot_bgcolor: '#161b22',
        font: { color: '#e6edf3', size: 11 },
        margin: { t: 36, r: 16, b: 36, l: 60 },
        legend: { bgcolor: 'transparent' }, showlegend: true,
        title: { text: 'RSI (14) + Stochastic RSI', font: { color: '#8b949e', size: 12 } },
        xaxis: { gridcolor: '#21262d' },
        yaxis:  { gridcolor: '#21262d', range: [0, 100], domain: [0.4, 1] },
        yaxis2: { gridcolor: '#21262d', range: [0, 1],   domain: [0, 0.35],
                  title: { text: 'Stoch RSI', font: { color: '#8b949e', size: 10 } } },
        height: 280
    };

    Plotly.newPlot('rsi-chart', [
        {
            x: times, y: candles.map(function(c) { return c.rsi; }),
            type: 'scatter', line: { color: '#58a6ff', width: 2 },
            name: 'RSI', fill: 'tozeroy', fillcolor: 'rgba(88,166,255,0.05)',
            yaxis: 'y'
        },
        {
            x: times, y: Array(times.length).fill(70),
            type: 'scatter', line: { color: '#f85149', dash: 'dash', width: 1 },
            name: 'Sobrecompra (70)', yaxis: 'y'
        },
        {
            x: times, y: Array(times.length).fill(30),
            type: 'scatter', line: { color: '#3fb950', dash: 'dash', width: 1 },
            name: 'Sobreventa (30)', yaxis: 'y'
        },
        {
            x: times, y: candles.map(function(c) { return c.stoch_k; }),
            type: 'scatter', line: { color: '#d29922', width: 1.5 },
            name: 'Stoch K', yaxis: 'y2'
        },
        {
            x: times, y: candles.map(function(c) { return c.stoch_d; }),
            type: 'scatter', line: { color: '#f0883e', width: 1.5 },
            name: 'Stoch D', yaxis: 'y2'
        }
    ], layout, { responsive: true });
}

function renderMACD(candles, times) {
    var layout = {
        autosize: true,
        paper_bgcolor: '#161b22', plot_bgcolor: '#161b22',
        font: { color: '#e6edf3', size: 11 },
        margin: { t: 36, r: 16, b: 36, l: 60 },
        legend: { bgcolor: 'transparent' }, showlegend: true,
        title: { text: 'MACD', font: { color: '#8b949e', size: 12 } },
        xaxis: { gridcolor: '#21262d' },
        yaxis: { gridcolor: '#21262d' }
    };

    Plotly.newPlot('macd-chart', [
        { x: times, y: candles.map(function(c) { return c.macd; }), type: 'scatter', line: { color: '#58a6ff', width: 2 }, name: 'MACD' },
        { x: times, y: candles.map(function(c) { return c.macd_signal; }), type: 'scatter', line: { color: '#f0883e', width: 2 }, name: 'Señal' },
        { x: times, y: candles.map(function(c) { return c.macd_diff; }), type: 'bar', marker: { color: candles.map(function(c) { return c.macd_diff >= 0 ? '#3fb950' : '#f85149'; }) }, name: 'Histograma' }
    ], layout, { responsive: true });
}

function renderGauge(buyProb) {
    var layout = {
        autosize: true,
        paper_bgcolor: '#161b22', plot_bgcolor: '#161b22',
        font: { color: '#e6edf3', size: 11 },
        margin: { t: 40, r: 20, b: 20, l: 20 }
    };

    Plotly.newPlot('prob-chart', [{
        type: 'indicator', mode: 'gauge+number',
        value: buyProb,
        title: { text: 'Prob. Compra %', font: { color: '#8b949e', size: 12 } },
        number: { font: { color: '#3fb950', size: 36 } },
        gauge: {
            axis: { range: [0, 100], tickcolor: '#8b949e' },
            bar:  { color: '#3fb950' },
            bgcolor: '#21262d',
            bordercolor: '#30363d',
            steps: [
                { range: [0,  30],  color: '#4a1a1a' },
                { range: [30, 70],  color: '#2d2a1a' },
                { range: [70, 100], color: '#1a4731' }
            ],
            threshold: { line: { color: '#58a6ff', width: 2 }, thickness: 0.75, value: buyProb }
        }
    }], layout, { responsive: true });
}

// ─── TENDENCIA 24H ───────────────────────────────────────────────────────────
function updateTrend() {
    var pair = document.getElementById('pair-select').value;
    fetch('/api/trend?pair=' + encodeURIComponent(pair))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var dirEl    = document.getElementById('trend-direction');
            var changeEl = document.getElementById('trend-change');

            dirEl.textContent = data.trend === 'UP' ? '▲ ALCISTA' : '▼ BAJISTA';
            dirEl.className   = 'trend-value ' + (data.trend === 'UP' ? 'trend-up' : 'trend-down');

            changeEl.textContent = (data.change_24h >= 0 ? '+' : '') + data.change_24h + '%';
            changeEl.className   = 'trend-value ' + (data.change_24h >= 0 ? 'trend-up' : 'trend-down');

            document.getElementById('trend-high').textContent   = '$' + data.high_24h.toLocaleString('en-US', { minimumFractionDigits: 2 });
            document.getElementById('trend-low').textContent    = '$' + data.low_24h.toLocaleString('en-US', { minimumFractionDigits: 2 });
            document.getElementById('trend-volume').textContent = data.volume_24h.toLocaleString('en-US') + ' BTC';

            if (Math.abs(data.change_24h) >= 2) {
                playSound('ALERT');
            }
        })
        .catch(function(err) { console.error('Error trend:', err); });
}

// ─── PRECIO EN TIEMPO REAL ───────────────────────────────────────────────────
function updatePriceRealtime() {
    var pair = document.getElementById('pair-select').value;
    fetch('/api/price?pair=' + encodeURIComponent(pair))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            updatePrice(data.price);
            updateTime();
        })
        .catch(function(err) { console.error('Error precio:', err); });
}

// ─── NOTICIAS ────────────────────────────────────────────────────────────────
function loadNews() {
    fetch('/api/news')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var container = document.getElementById('news-container');
            if (!data.news || data.news.length === 0) {
                container.innerHTML = '<div style="color:#8b949e; text-align:center; padding:20px;">No hay noticias disponibles</div>';
                return;
            }
            container.innerHTML = data.news.map(function(n) {
                return '<div class="news-item">' +
                    '<a class="news-title" href="' + n.link + '" target="_blank">' + n.title + '</a>' +
                    '<div class="news-meta">' +
                        '<span class="news-source">' + n.source + '</span>' +
                        '<span>' + n.date + '</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        })
        .catch(function(err) { console.error('Error noticias:', err); });
}

// Noticias cada 5 minutos
var currentLang = 'en';

function switchLang(lang) {
    currentLang = lang;
    document.getElementById('btn-en').className = lang === 'en' ? 'active' : '';
    document.getElementById('btn-es').className = lang === 'es' ? 'active' : '';
    loadNews();
}

function loadNews() {
    fetch('/api/news?lang=' + currentLang)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var container = document.getElementById('news-container');
            if (!data.news || data.news.length === 0) {
                container.innerHTML = '<div style="color:#8b949e; text-align:center; padding:20px;">No hay noticias disponibles</div>';
                return;
            }
            container.innerHTML = data.news.map(function(n) {
                return '<div class="news-item">' +
                    '<a class="news-title" href="' + n.link + '" target="_blank">' + n.title + '</a>' +
                    '<div class="news-meta">' +
                        '<span class="news-source">' + n.source + '</span>' +
                        '<span>' + n.date + '</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        })
        .catch(function(err) { console.error('Error noticias:', err); });
}

loadNews();
setInterval(loadNews, 300000);

// ─── MULTI-PAR ───────────────────────────────────────────────────────────────
function loadMultipair() {
    fetch('/api/multipair')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var container = document.getElementById('multipair-container');
            container.innerHTML =
                '<table class="signals-table">' +
                '<thead><tr>' +
                '<th>Par</th><th>Precio</th><th>Cambio 24h</th>' +
                '<th>RSI</th><th>MACD</th><th>Señal</th><th>Volumen</th>' +
                '</tr></thead><tbody>' +
                data.pairs.map(function(p) {
                    var changeColor = p.change_24h >= 0 ? '#3fb950' : '#f85149';
                    var signalClass = p.signal === 'COMPRA' ? 'buy' : p.signal === 'VENTA' ? 'sell' : 'neutral';
                    return '<tr>' +
                        '<td style="font-weight:bold">' + p.pair + '</td>' +
                        '<td>$' + p.price.toLocaleString('en-US', {minimumFractionDigits:2}) + '</td>' +
                        '<td style="color:' + changeColor + '">' + (p.change_24h >= 0 ? '+' : '') + p.change_24h + '%</td>' +
                        '<td>' + p.rsi + '</td>' +
                        '<td>' + p.macd_diff + '</td>' +
                        '<td><span class="badge badge-' + signalClass + '">' + p.signal + '</span></td>' +
                        '<td>$' + p.volume.toLocaleString() + '</td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table>';
        })
        .catch(function(err) { console.error('Error multipair:', err); });
}

loadMultipair();
setInterval(loadMultipair, 60000);

// ─── BACKTESTING ─────────────────────────────────────────────────────────────
function runBacktest() {
    var pair    = document.getElementById('bt-pair').value;
    var tf      = document.getElementById('bt-tf').value;
    var capital = document.getElementById('bt-capital').value;

    document.getElementById('bt-loading').style.display = 'block';
    document.getElementById('bt-results').style.display = 'none';

    fetch('/api/backtest?pair=' + encodeURIComponent(pair) + '&tf=' + tf + '&capital=' + capital)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            document.getElementById('bt-loading').style.display = 'none';
            document.getElementById('bt-results').style.display = 'block';

            var retEl = document.getElementById('bt-return');
            retEl.textContent = data.total_return + '%';
            retEl.style.color = data.total_return >= 0 ? '#3fb950' : '#f85149';

            var bhEl = document.getElementById('bt-buyhold');
            bhEl.textContent = data.buy_hold + '%';
            bhEl.style.color = data.buy_hold >= 0 ? '#3fb950' : '#f85149';

            document.getElementById('bt-winrate').textContent = data.win_rate + '%';
            document.getElementById('bt-trades').textContent  = data.total_trades;

            // Gráfico equity
            var times  = data.equity_curve.map(function(e) { return e.time; });
            var equity = data.equity_curve.map(function(e) { return e.equity; });
            var prices = data.equity_curve.map(function(e) { return e.price; });

            var buyTimes  = data.trades.filter(function(t) { return t.type === 'BUY'; }).map(function(t) { return t.time; });
            var sellTimes = data.trades.filter(function(t) { return t.type === 'SELL'; }).map(function(t) { return t.time; });
            var buyPrices  = data.trades.filter(function(t) { return t.type === 'BUY'; }).map(function(t) { return t.price; });
            var sellPrices = data.trades.filter(function(t) { return t.type === 'SELL'; }).map(function(t) { return t.price; });

            Plotly.newPlot('bt-equity-chart', [
                {
                    x: times, y: equity,
                    type: 'scatter', line: { color: '#58a6ff', width: 2 },
                    name: 'Equity', fill: 'tozeroy', fillcolor: 'rgba(88,166,255,0.05)'
                },
                {
                    x: buyTimes, y: buyPrices,
                    mode: 'markers', name: 'Compra',
                    marker: { color: '#3fb950', size: 10, symbol: 'triangle-up' },
                    yaxis: 'y2'
                },
                {
                    x: sellTimes, y: sellPrices,
                    mode: 'markers', name: 'Venta',
                    marker: { color: '#f85149', size: 10, symbol: 'triangle-down' },
                    yaxis: 'y2'
                },
                {
                    x: times, y: prices,
                    type: 'scatter', line: { color: '#8b949e', width: 1 },
                    name: 'Precio', yaxis: 'y2'
                }
            ], {
                paper_bgcolor: '#161b22', plot_bgcolor: '#161b22',
                font: { color: '#e6edf3', size: 11 },
                margin: { t: 36, r: 16, b: 36, l: 60 },
                legend: { bgcolor: 'transparent' },
                showlegend: true,
                title: { text: 'Curva de Equity vs Precio', font: { color: '#8b949e', size: 12 } },
                xaxis:  { gridcolor: '#21262d' },
                yaxis:  { gridcolor: '#21262d', title: { text: 'Equity $', font: { color: '#8b949e', size: 10 } } },
                yaxis2: { gridcolor: '#21262d', overlaying: 'y', side: 'right', title: { text: 'Precio', font: { color: '#8b949e', size: 10 } } }
            }, { responsive: true });

            // Tabla de trades
            var sells = data.trades.filter(function(t) { return t.type === 'SELL'; });
            if (sells.length > 0) {
                document.getElementById('bt-trades-list').innerHTML =
                    '<table class="signals-table">' +
                    '<thead><tr><th>Fecha</th><th>Tipo</th><th>Precio</th><th>RSI</th><th>P&L</th></tr></thead>' +
                    '<tbody>' +
                    data.trades.map(function(t) {
                        var pnl = t.pnl !== undefined ? (t.pnl >= 0 ? '+$' + t.pnl : '-$' + Math.abs(t.pnl)) : '—';
                        var color = t.pnl !== undefined ? (t.pnl >= 0 ? '#3fb950' : '#f85149') : '#8b949e';
                        return '<tr>' +
                            '<td style="color:#8b949e">' + t.time.substring(0,16) + '</td>' +
                            '<td><span class="badge badge-' + (t.type === 'BUY' ? 'buy' : 'sell') + '">' + t.type + '</span></td>' +
                            '<td>$' + t.price + '</td>' +
                            '<td>' + t.rsi + '</td>' +
                            '<td style="color:' + color + '">' + pnl + '</td>' +
                            '</tr>';
                    }).join('') +
                    '</tbody></table>';
            }
        })
        .catch(function(err) {
            document.getElementById('bt-loading').style.display = 'none';
            console.error('Error backtest:', err);
        });
}

// ─── IA PREDICTIVA ───────────────────────────────────────────────────────────
function trainModel() {
    var pair = document.getElementById('ai-pair').value;
    var tf   = document.getElementById('ai-tf').value;

    document.getElementById('ai-loading').style.display = 'block';
    document.getElementById('ai-results').style.display = 'none';
    document.getElementById('ai-loading').textContent   = '⚡ Entrenando modelo con 1000 velas...';

    fetch('/api/predict?pair=' + encodeURIComponent(pair) + '&tf=' + tf + '&action=train')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            document.getElementById('ai-loading').style.display = 'none';
            alert('✅ Modelo entrenado con ' + data.accuracy + '% de precisión');
            runPrediction();
        })
        .catch(function(err) {
            document.getElementById('ai-loading').style.display = 'none';
            console.error('Error training:', err);
        });
}

function runPrediction() {
    var pair = document.getElementById('ai-pair').value;
    var tf   = document.getElementById('ai-tf').value;

    document.getElementById('ai-loading').style.display  = 'block';
    document.getElementById('ai-results').style.display  = 'none';
    document.getElementById('ai-loading').textContent    = '🔮 Calculando predicción...';

    fetch('/api/predict?pair=' + encodeURIComponent(pair) + '&tf=' + tf)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            document.getElementById('ai-loading').style.display = 'none';

            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            document.getElementById('ai-results').style.display = 'block';

            var predEl = document.getElementById('ai-prediction');
            predEl.textContent = data.prediction === 'SUBE' ? '📈 SUBE' : '📉 BAJA';
            predEl.style.color = data.prediction === 'SUBE' ? '#3fb950' : '#f85149';

            document.getElementById('ai-up').textContent          = data.up_probability + '%';
            document.getElementById('ai-down').textContent        = data.down_probability + '%';
            document.getElementById('ai-up-bar').style.width      = data.up_probability + '%';
            document.getElementById('ai-down-bar').style.width    = data.down_probability + '%';
            document.getElementById('ai-confidence').textContent  = data.confidence + '%';
            document.getElementById('ai-confidence').style.color  = data.confidence > 60 ? '#3fb950' : '#d29922';

            if (data.accuracy) {
                document.getElementById('ai-accuracy').textContent = '📊 Precisión del modelo: ' + data.accuracy + '%';
            }
        })
        .catch(function(err) {
            document.getElementById('ai-loading').style.display = 'none';
            console.error('Error prediction:', err);
        });
}

// ─── SOCKET & INIT ───────────────────────────────────────────────────────────
socket.on('update', updateDashboard);

fetchData('BTC/USDT', '1h');
updateTrend();

setInterval(function() {
    var tf = document.getElementById('tf-select').value;
    fetchData(currentPair, tf);
}, 60000);

setInterval(updatePriceRealtime, 3000);
setInterval(updateTrend, 30000);

// ─── RESPONSIVE RESIZE ───────────────────────────────────────────────────────
var resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        var charts = [
            'candlestick-chart',
            'rsi-chart',
            'macd-chart',
            'prob-chart',
            'bt-equity-chart'
        ];
        charts.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                Plotly.Plots.resize(el);
            }
        });
    }, 250);
});