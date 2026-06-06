// ─── PAPER TRADING ───────────────────────────────────────────────────────────
var paperPortfolio = {
    capital:    50000,
    positions:  {},
    trades:     [],
    initial:    50000
};

function getPaperPnL() {
    var total = paperPortfolio.capital;
    Object.keys(paperPortfolio.positions).forEach(function(pair) {
        var pos = paperPortfolio.positions[pair];
        total += pos.amount * pos.currentPrice;
    });
    return round2(total - paperPortfolio.initial);
}

function round2(n) { return Math.round(n * 100) / 100; }

function paperBuy() {
    var pair    = document.getElementById('paper-pair').value;
    var amount  = parseFloat(document.getElementById('paper-amount').value);
    var capital = paperPortfolio.capital;

    if (!amount || amount <= 0) { alert('Ingresa un monto válido'); return; }

    fetch('/api/paper/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BUY', pair: pair, amount: amount / 100 })
    })
    .then(function(r) { return r.json(); })
    .then(function(order) {
        var cost = order.price * order.amount;
        if (cost > paperPortfolio.capital) {
            alert('Capital insuficiente. Tienes $' + paperPortfolio.capital.toLocaleString());
            return;
        }
        paperPortfolio.capital -= cost;
        if (!paperPortfolio.positions[pair]) {
            paperPortfolio.positions[pair] = { amount: 0, avgPrice: 0, currentPrice: order.price };
        }
        var pos = paperPortfolio.positions[pair];
        pos.avgPrice    = ((pos.avgPrice * pos.amount) + (order.price * order.amount)) / (pos.amount + order.amount);
        pos.amount     += order.amount;
        pos.currentPrice = order.price;

        paperPortfolio.trades.unshift({
            type:      'COMPRA',
            pair:      pair,
            price:     order.price,
            amount:    round2(order.amount),
            total:     round2(cost),
            timestamp: order.timestamp
        });

        updatePaperUI();
    })
    .catch(function(err) { console.error('Error paper buy:', err); });
}

function paperSell() {
    var pair = document.getElementById('paper-pair').value;
    var pos  = paperPortfolio.positions[pair];

    if (!pos || pos.amount <= 0) {
        alert('No tienes posición en ' + pair);
        return;
    }

    fetch('/api/paper/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SELL', pair: pair, amount: pos.amount })
    })
    .then(function(r) { return r.json(); })
    .then(function(order) {
        var revenue = order.price * pos.amount;
        var pnl     = round2(revenue - (pos.avgPrice * pos.amount));

        paperPortfolio.capital += revenue;
        paperPortfolio.trades.unshift({
            type:      'VENTA',
            pair:      pair,
            price:     order.price,
            amount:    round2(pos.amount),
            total:     round2(revenue),
            pnl:       pnl,
            timestamp: order.timestamp
        });

        delete paperPortfolio.positions[pair];
        updatePaperUI();
    })
    .catch(function(err) { console.error('Error paper sell:', err); });
}

function updatePaperUI() {
    var totalEquity = paperPortfolio.capital;
    Object.keys(paperPortfolio.positions).forEach(function(pair) {
        var pos = paperPortfolio.positions[pair];
        totalEquity += pos.amount * pos.currentPrice;
    });

    var pnl     = round2(totalEquity - paperPortfolio.initial);
    var pnlPct  = round2((pnl / paperPortfolio.initial) * 100);
    var pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';

    document.getElementById('paper-capital').textContent    = '$' + round2(paperPortfolio.capital).toLocaleString('en-US', {minimumFractionDigits:2});
    document.getElementById('paper-equity').textContent     = '$' + round2(totalEquity).toLocaleString('en-US', {minimumFractionDigits:2});
    document.getElementById('paper-pnl').textContent        = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toLocaleString('en-US', {minimumFractionDigits:2});
    document.getElementById('paper-pnl').style.color        = pnlColor;
    document.getElementById('paper-pnl-pct').textContent    = (pnlPct >= 0 ? '+' : '') + pnlPct + '%';
    document.getElementById('paper-pnl-pct').style.color    = pnlColor;

    // Posiciones
    var posHtml = Object.keys(paperPortfolio.positions).map(function(pair) {
        var pos    = paperPortfolio.positions[pair];
        var posPnl = round2((pos.currentPrice - pos.avgPrice) * pos.amount);
        var posColor = posPnl >= 0 ? '#3fb950' : '#f85149';
        return '<tr>' +
            '<td style="font-weight:bold">' + pair + '</td>' +
            '<td>' + round2(pos.amount) + '</td>' +
            '<td>$' + round2(pos.avgPrice).toLocaleString() + '</td>' +
            '<td>$' + round2(pos.currentPrice).toLocaleString() + '</td>' +
            '<td style="color:' + posColor + '">' + (posPnl >= 0 ? '+$' : '-$') + Math.abs(posPnl).toLocaleString() + '</td>' +
            '</tr>';
    }).join('');

    document.getElementById('paper-positions').innerHTML = posHtml ||
        '<tr><td colspan="5" style="color:#8b949e; text-align:center">Sin posiciones abiertas</td></tr>';

    // Historial
    var tradesHtml = paperPortfolio.trades.slice(0, 10).map(function(t) {
        var pnlStr = t.pnl !== undefined ? (t.pnl >= 0 ? '+$' + t.pnl : '-$' + Math.abs(t.pnl)) : '—';
        var pnlColor = t.pnl !== undefined ? (t.pnl >= 0 ? '#3fb950' : '#f85149') : '#8b949e';
        return '<tr>' +
            '<td style="color:#8b949e">' + t.timestamp + '</td>' +
            '<td><span class="badge badge-' + (t.type === 'COMPRA' ? 'buy' : 'sell') + '">' + t.type + '</span></td>' +
            '<td>' + t.pair + '</td>' +
            '<td>$' + t.price.toLocaleString() + '</td>' +
            '<td>' + t.amount + '</td>' +
            '<td style="color:' + pnlColor + '">' + pnlStr + '</td>' +
            '</tr>';
    }).join('');

    document.getElementById('paper-trades').innerHTML = tradesHtml ||
        '<tr><td colspan="6" style="color:#8b949e; text-align:center">Sin operaciones</td></tr>';
}

function addCapital() {
    var amount = parseFloat(prompt('¿Cuánto capital quieres agregar?', '10000'));
    if (!amount || amount <= 0) return;
    paperPortfolio.capital  += amount;
    paperPortfolio.initial  += amount;
    updatePaperUI();
    alert('✅ Se agregaron $' + amount.toLocaleString() + ' a tu cuenta');
}