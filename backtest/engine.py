import pandas as pd
import ta
from data.market_data import get_exchange

def run_backtest(pair='BTC/USDT', tf='1h', limit=500,
                 rsi_buy=30, rsi_sell=70, initial_capital=1000):

    exchange = get_exchange()
    ohlcv    = exchange.fetch_ohlcv(pair, tf, limit=limit)
    df       = pd.DataFrame(ohlcv, columns=['timestamp','open','high','low','close','volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

    # Indicadores
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    macd = ta.trend.MACD(df['close'])
    df['macd_diff'] = macd.macd_diff()
    df['ema_50']    = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    df['ema_200']   = ta.trend.EMAIndicator(df['close'], window=200).ema_indicator()
    df = df.dropna()

    # Simulación
    capital      = initial_capital
    position     = 0
    entry_price  = 0
    trades       = []
    equity_curve = []

    for _, row in df.iterrows():
        equity = capital + (position * row['close'] if position > 0 else 0)
        equity_curve.append({
            'time':   str(row['timestamp']),
            'equity': round(equity, 2),
            'price':  row['close']
        })

        # Señal de COMPRA
        if position == 0 and row['rsi'] < rsi_buy and row['macd_diff'] > 0:
            position    = capital / row['close']
            entry_price = row['close']
            capital     = 0
            trades.append({
                'type':  'BUY',
                'time':  str(row['timestamp']),
                'price': round(row['close'], 2),
                'rsi':   round(row['rsi'], 2)
            })

        # Señal de VENTA
        elif position > 0 and row['rsi'] > rsi_sell and row['macd_diff'] < 0:
            capital     = position * row['close']
            pnl         = round(capital - initial_capital, 2)
            position    = 0
            trades.append({
                'type':  'SELL',
                'time':  str(row['timestamp']),
                'price': round(row['close'], 2),
                'rsi':   round(row['rsi'], 2),
                'pnl':   pnl
            })

    # Resultado final
    final_equity  = capital + (position * df.iloc[-1]['close'] if position > 0 else 0)
    total_return  = round(((final_equity - initial_capital) / initial_capital) * 100, 2)
    buy_hold      = round(((df.iloc[-1]['close'] - df.iloc[0]['close']) / df.iloc[0]['close']) * 100, 2)
    wins          = [t for t in trades if t.get('type') == 'SELL' and t.get('pnl', 0) > 0]
    losses        = [t for t in trades if t.get('type') == 'SELL' and t.get('pnl', 0) <= 0]
    win_rate      = round(len(wins) / max(len(losses) + len(wins), 1) * 100, 2)

    return {
        'trades':        trades,
        'equity_curve':  equity_curve,
        'total_return':  total_return,
        'buy_hold':      buy_hold,
        'final_equity':  round(final_equity, 2),
        'total_trades':  len([t for t in trades if t['type'] == 'SELL']),
        'win_rate':      win_rate,
        'initial_capital': initial_capital
    }