import ccxt
from config.settings import BINANCE_API_KEY, BINANCE_SECRET_KEY, SYMBOL, TIMEFRAME

def get_exchange():
    exchange = ccxt.binance({
        'apiKey': BINANCE_API_KEY,
        'secret': BINANCE_SECRET_KEY,
        'enableRateLimit': True,
    })
    return exchange

def get_ohlcv(limit=100):
    exchange = get_exchange()
    ohlcv = exchange.fetch_ohlcv(SYMBOL, TIMEFRAME, limit=limit)
    return ohlcv

def get_current_price():
    exchange = get_exchange()
    ticker = exchange.fetch_ticker(SYMBOL)
    return ticker['last']