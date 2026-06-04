import requests
from config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

def send_telegram_alert(message):
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown"
        }
        response = requests.post(url, json=payload)
        print(f"✅ Alerta enviada a Telegram")
    except Exception as e:
        print(f"❌ Error enviando alerta: {e}")

def alert_buy(price, rsi, macd_diff):
    message = (
        f"🟢 *SEÑAL DE COMPRA - BTC/USDT*\n"
        f"💰 Precio: ${price}\n"
        f"📊 RSI: {rsi} (Sobrevendido)\n"
        f"📈 MACD Diff: {macd_diff}\n"
        f"⚡ Acción: Considerar COMPRA"
    )
    send_telegram_alert(message)

def alert_sell(price, rsi, macd_diff):
    message = (
        f"🔴 *SEÑAL DE VENTA - BTC/USDT*\n"
        f"💰 Precio: ${price}\n"
        f"📊 RSI: {rsi} (Sobrecomprado)\n"
        f"📉 MACD Diff: {macd_diff}\n"
        f"⚡ Acción: Considerar VENTA"
    )
    send_telegram_alert(message)

def alert_price_drop(price, change_pct):
    message = (
        f"⚠️ *ALERTA DE CAÍDA - BTC/USDT*\n"
        f"💰 Precio actual: ${price}\n"
        f"📉 Caída: {change_pct}%\n"
        f"🚨 Revisión urgente recomendada"
    )
    send_telegram_alert(message)

def alert_price_surge(price, change_pct):
    message = (
        f"🚀 *ALERTA DE SUBIDA - BTC/USDT*\n"
        f"💰 Precio actual: ${price}\n"
        f"📈 Subida: {change_pct}%\n"
        f"👀 Oportunidad detectada"
    )
    send_telegram_alert(message)
    