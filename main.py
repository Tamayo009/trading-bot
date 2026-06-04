import schedule
import time
from strategies.rsi_macd import analyze
from data.market_data import get_current_price
from alerts.telegram import alert_buy, alert_sell, alert_price_drop, alert_price_surge

# Precio anterior para calcular cambios
last_price = None

def run_strategy():
    print("🔍 Analizando mercado...")
    result = analyze()
    print(f"📊 RSI: {result['rsi']} | MACD: {result['macd_diff']} | Precio: ${result['price']}")

    if result['signal'] == "BUY":
        print("🟢 Señal de COMPRA detectada!")
        alert_buy(result['price'], result['rsi'], result['macd_diff'])

    elif result['signal'] == "SELL":
        print("🔴 Señal de VENTA detectada!")
        alert_sell(result['price'], result['rsi'], result['macd_diff'])

    else:
        print("⏳ Sin señal clara. Esperando...")

def check_price_alerts():
    global last_price
    current_price = get_current_price()

    if last_price is None:
        last_price = current_price
        return

    change_pct = round(((current_price - last_price) / last_price) * 100, 2)
    print(f"💰 Precio actual: ${current_price} | Cambio: {change_pct}%")

    if change_pct <= -2:
        print("⚠️ Caída brusca detectada!")
        alert_price_drop(current_price, change_pct)

    elif change_pct >= 2:
        print("🚀 Subida brusca detectada!")
        alert_price_surge(current_price, change_pct)

    last_price = current_price

# Programar tareas
schedule.every(1).hours.do(run_strategy)
schedule.every(5).minutes.do(check_price_alerts)

print("🤖 Bot de Trading iniciado!")
print("📡 Monitoreando BTC/USDT en Binance...")

run_strategy()
check_price_alerts()

while True:
    schedule.run_pending()
    time.sleep(1)