import pandas as pd
import ta
from data.market_data import get_ohlcv
from config.settings import (
    RSI_PERIOD, RSI_OVERBOUGHT, RSI_OVERSOLD,
    MACD_FAST, MACD_SLOW, MACD_SIGNAL
)

def get_dataframe():
    ohlcv = get_ohlcv(limit=100)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df

def analyze():
    df = get_dataframe()

    # RSI
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=RSI_PERIOD).rsi()

    # MACD
    macd = ta.trend.MACD(df['close'], window_fast=MACD_FAST, window_slow=MACD_SLOW, window_sign=MACD_SIGNAL)
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['macd_diff'] = macd.macd_diff()

    last = df.iloc[-1]
    signal = None

    # Señal de COMPRA
    if last['rsi'] < RSI_OVERSOLD and last['macd_diff'] > 0:
        signal = "BUY"

    # Señal de VENTA
    elif last['rsi'] > RSI_OVERBOUGHT and last['macd_diff'] < 0:
        signal = "SELL"

    return {
        'signal': signal,
        'rsi': round(last['rsi'], 2),
        'macd_diff': round(last['macd_diff'], 4),
        'price': round(last['close'], 2)
    }