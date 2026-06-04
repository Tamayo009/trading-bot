from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
import threading
import time
import pandas as pd
from data.market_data import get_exchange
import ta

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

def calculate_probability(rsi, macd_diff, ema_50=None, ema_200=None, close=None):
    buy_score  = 0
    sell_score = 0

    if rsi < 30: buy_score += 40
    elif rsi < 40: buy_score += 20
    elif rsi > 70: sell_score += 40
    elif rsi > 60: sell_score += 20

    if macd_diff > 0: buy_score += 30
    else: sell_score += 30

    if ema_50 and ema_200 and close:
        if close > ema_50 > ema_200: buy_score += 30
        elif close < ema_50 < ema_200: sell_score += 30

    total = buy_score + sell_score
    if total == 0:
        return 50, 50
    buy_prob  = round((buy_score / total) * 100)
    sell_prob = 100 - buy_prob
    return buy_prob, sell_prob

def build_dataframe(ohlcv):
    df = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()

    macd = ta.trend.MACD(df['close'])
    df['macd']        = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['macd_diff']   = macd.macd_diff()

    df['ema_50']  = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    df['ema_200'] = ta.trend.EMAIndicator(df['close'], window=200).ema_indicator()

    stoch = ta.momentum.StochRSIIndicator(df['close'], window=14)
    df['stoch_k'] = stoch.stochrsi_k()
    df['stoch_d'] = stoch.stochrsi_d()

    df = df.dropna(subset=['rsi','macd','macd_diff'])
    return df

def build_candles(df):
    candles = []
    for _, row in df.tail(50).iterrows():
        candles.append({
            'time':         str(row['timestamp']),
            'open':         row['open'],
            'high':         row['high'],
            'low':          row['low'],
            'close':        row['close'],
            'volume':       round(row['volume'], 2),
            'rsi':          round(row['rsi'], 2),
            'macd':         round(row['macd'], 4),
            'macd_signal':  round(row['macd_signal'], 4),
            'macd_diff':    round(row['macd_diff'], 4),
            'ema_50':       round(row['ema_50'],  2) if not pd.isna(row['ema_50'])  else None,
            'ema_200':      round(row['ema_200'], 2) if not pd.isna(row['ema_200']) else None,
            'stoch_k':      round(row['stoch_k'], 4) if not pd.isna(row['stoch_k']) else None,
            'stoch_d':      round(row['stoch_d'], 4) if not pd.isna(row['stoch_d']) else None,
        })
    return candles

def get_signal(last):
    if last['rsi'] < 30 and last['macd_diff'] > 0:
        return "COMPRA"
    elif last['rsi'] > 70 and last['macd_diff'] < 0:
        return "VENTA"
    return "NEUTRAL"

@app.route('/api/price')
def get_price():
    pair     = request.args.get('pair', 'BTC/USDT')
    exchange = get_exchange()
    ticker   = exchange.fetch_ticker(pair)
    return jsonify({'price': ticker['last'], 'change': ticker['percentage']})

@app.route('/api/news')
def get_news():
    import feedparser
    lang = request.args.get('lang', 'en')
    
    feeds_en = [
        'https://cointelegraph.com/rss',
        'https://coindesk.com/arc/outboundfeeds/rss/',
    ]
    
    feeds_es = [
        'https://es.cointelegraph.com/rss',
        'https://www.criptonoticias.com/feed/',
    ]
    
    feeds = feeds_es if lang == 'es' else feeds_en
    news = []
    for feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:5]:
                news.append({
                    'title':  entry.title,
                    'link':   entry.link,
                    'source': feed.feed.title,
                    'date':   entry.get('published', '')
                })
        except Exception as e:
            print(f"Error fetching news: {e}")
    return jsonify({'news': news[:10]})

@app.route('/api/backtest')
def get_backtest():
    from backtest.engine import run_backtest
    pair    = request.args.get('pair', 'BTC/USDT')
    tf      = request.args.get('tf', '1h')
    capital = float(request.args.get('capital', 1000))
    rsi_buy  = int(request.args.get('rsi_buy', 30))
    rsi_sell = int(request.args.get('rsi_sell', 70))
    
    result = run_backtest(
        pair=pair, tf=tf,
        initial_capital=capital,
        rsi_buy=rsi_buy,
        rsi_sell=rsi_sell
    )
    return jsonify(result)

@app.route('/api/multipair')
def get_multipair():
    pairs    = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'ADA/USDT']
    exchange = get_exchange()
    result   = []

    for pair in pairs:
        try:
            ticker = exchange.fetch_ticker(pair)
            ohlcv  = exchange.fetch_ohlcv(pair, '1h', limit=50)
            df     = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df['rsi']       = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
            macd            = ta.trend.MACD(df['close'])
            df['macd_diff'] = macd.macd_diff()
            df = df.dropna()
            last = df.iloc[-1]

            signal = 'NEUTRAL'
            if last['rsi'] < 30 and last['macd_diff'] > 0:
                signal = 'COMPRA'
            elif last['rsi'] > 70 and last['macd_diff'] < 0:
                signal = 'VENTA'

            result.append({
                'pair':       pair,
                'price':      ticker['last'],
                'change_24h': round(ticker['percentage'], 2),
                'rsi':        round(last['rsi'], 2),
                'macd_diff':  round(last['macd_diff'], 4),
                'signal':     signal,
                'volume':     round(ticker['quoteVolume'], 0)
            })
        except Exception as e:
            print(f"Error {pair}: {e}")

    return jsonify({'pairs': result})

@app.route('/api/predict')
def get_prediction():
    from strategies.ml_model import predict, train_model
    pair   = request.args.get('pair', 'BTC/USDT')
    tf     = request.args.get('tf', '1h')
    action = request.args.get('action', 'predict')

    try:
        if action == 'train':
            accuracy = train_model(pair, tf)
            return jsonify({'status': 'trained', 'accuracy': accuracy})
        else:
            result = predict(pair, tf)
            return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/paper/order', methods=['POST'])
def paper_order():
    data     = request.get_json()
    order_type = data.get('type')
    pair     = data.get('pair', 'BTC/USDT')
    amount   = float(data.get('amount', 0))

    exchange = get_exchange()
    ticker   = exchange.fetch_ticker(pair)
    price    = ticker['last']

    return jsonify({
        'type':      order_type,
        'pair':      pair,
        'price':     price,
        'amount':    amount,
        'total':     round(price * amount, 2),
        'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/api/trend')
def get_trend():
    pair     = request.args.get('pair', 'BTC/USDT')
    exchange = get_exchange()
    ticker   = exchange.fetch_ticker(pair)
    ohlcv    = exchange.fetch_ohlcv(pair, '1h', limit=24)
    df       = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])

    current    = ticker['last']
    open_24h   = df.iloc[0]['open']
    high_24h   = float(df['high'].max())
    low_24h    = float(df['low'].min())
    volume_24h = float(df['volume'].sum())
    change_24h = round(((current - open_24h) / open_24h) * 100, 2)

    return jsonify({
        'current':    current,
        'change_24h': change_24h,
        'high_24h':   high_24h,
        'low_24h':    low_24h,
        'volume_24h': round(volume_24h, 2),
        'trend':      'UP' if change_24h > 0 else 'DOWN'
    })

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    pair     = request.args.get('pair', 'BTC/USDT')
    tf       = request.args.get('tf', '1h')
    exchange = get_exchange()
    ohlcv    = exchange.fetch_ohlcv(pair, tf, limit=200)
    df       = build_dataframe(ohlcv)
    last     = df.iloc[-1]

    buy_prob, sell_prob = calculate_probability(
        last['rsi'], last['macd_diff'],
        ema_50=last['ema_50']   if not pd.isna(last['ema_50'])  else None,
        ema_200=last['ema_200'] if not pd.isna(last['ema_200']) else None,
        close=last['close']
    )

    candles = build_candles(df)
    signal  = get_signal(last)
    ticker  = exchange.fetch_ticker(pair)

    return jsonify({
        'candles':          candles,
        'current_price':    ticker['last'],
        'rsi':              round(last['rsi'], 2),
        'macd_diff':        round(last['macd_diff'], 4),
        'signal':           signal,
        'buy_probability':  buy_prob,
        'sell_probability': sell_prob
    })

def background_update():
    while True:
        try:
            with app.app_context():
                exchange = get_exchange()
                ohlcv    = exchange.fetch_ohlcv('BTC/USDT', '1h', limit=200)
                df       = build_dataframe(ohlcv)
                last     = df.iloc[-1]

                buy_prob, sell_prob = calculate_probability(
                    last['rsi'], last['macd_diff'],
                    ema_50=last['ema_50']   if not pd.isna(last['ema_50'])  else None,
                    ema_200=last['ema_200'] if not pd.isna(last['ema_200']) else None,
                    close=last['close']
                )

                candles = build_candles(df)
                signal  = get_signal(last)
                ticker  = exchange.fetch_ticker('BTC/USDT')

                socketio.emit('update', {
                    'candles':          candles,
                    'current_price':    ticker['last'],
                    'rsi':              round(last['rsi'], 2),
                    'macd_diff':        round(last['macd_diff'], 4),
                    'signal':           signal,
                    'buy_probability':  buy_prob,
                    'sell_probability': sell_prob
                })
        except Exception as e:
            print(f"Error en background: {e}")
        time.sleep(5)

if __name__ == '__main__':
    thread = threading.Thread(target=background_update)
    thread.daemon = True
    thread.start()
    print("🌐 Dashboard iniciado en http://localhost:5000")
    socketio.run(app, debug=False, port=5000)