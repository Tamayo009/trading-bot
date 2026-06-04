import pandas as pd
import numpy as np
import ta
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os
from data.market_data import get_exchange

MODEL_PATH  = 'strategies/model.pkl'
SCALER_PATH = 'strategies/scaler.pkl'

def build_features(df):
    df['rsi']       = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['rsi_fast']  = ta.momentum.RSIIndicator(df['close'], window=7).rsi()
    macd            = ta.trend.MACD(df['close'])
    df['macd']      = macd.macd()
    df['macd_diff'] = macd.macd_diff()
    df['ema_20']    = ta.trend.EMAIndicator(df['close'], window=20).ema_indicator()
    df['ema_50']    = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    df['ema_200']   = ta.trend.EMAIndicator(df['close'], window=200).ema_indicator()
    bb              = ta.volatility.BollingerBands(df['close'])
    df['bb_high']   = bb.bollinger_hband()
    df['bb_low']    = bb.bollinger_lband()
    df['bb_width']  = (df['bb_high'] - df['bb_low']) / df['close']
    stoch           = ta.momentum.StochRSIIndicator(df['close'])
    df['stoch_k']   = stoch.stochrsi_k()
    df['stoch_d']   = stoch.stochrsi_d()
    df['volume_ma'] = df['volume'].rolling(20).mean()
    df['volume_ratio'] = df['volume'] / df['volume_ma']
    df['price_change'] = df['close'].pct_change()
    df['high_low_ratio'] = (df['high'] - df['low']) / df['close']

    # Target: 1 si el precio sube en las próximas 3 velas, 0 si baja
    df['target'] = (df['close'].shift(-3) > df['close']).astype(int)

    return df.dropna()

def train_model(pair='BTC/USDT', tf='1h', limit=1000):
    exchange = get_exchange()
    ohlcv    = exchange.fetch_ohlcv(pair, tf, limit=limit)
    df       = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df       = build_features(df)

    features = ['rsi','rsi_fast','macd','macd_diff','ema_20','ema_50',
                'bb_width','stoch_k','stoch_d','volume_ratio',
                'price_change','high_low_ratio']

    X = df[features]
    y = df['target']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    scaler  = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    accuracy = model.score(X_test, y_test)

    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    return round(accuracy * 100, 2)

def predict(pair='BTC/USDT', tf='1h'):
    if not os.path.exists(MODEL_PATH):
        accuracy = train_model(pair, tf)
    else:
        accuracy = None

    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    exchange = get_exchange()
    ohlcv    = exchange.fetch_ohlcv(pair, tf, limit=300)
    df       = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df       = build_features(df)

    features = ['rsi','rsi_fast','macd','macd_diff','ema_20','ema_50',
                'bb_width','stoch_k','stoch_d','volume_ratio',
                'price_change','high_low_ratio']

    last    = df[features].iloc[-1:]
    last_sc = scaler.transform(last)
    proba   = model.predict_proba(last_sc)[0]

    return {
        'up_probability':   round(proba[1] * 100, 2),
        'down_probability': round(proba[0] * 100, 2),
        'prediction':       'SUBE' if proba[1] > 0.5 else 'BAJA',
        'confidence':       round(max(proba) * 100, 2),
        'accuracy':         accuracy
    }