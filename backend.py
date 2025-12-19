import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from dotenv import load_dotenv

# Configuración inicial
load_dotenv()
app = Flask(__name__)
CORS(app) # Habilitar CORS para todas las rutas

# Configuración de Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de API (GroqCloud)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

def load_personality():
    try:
        with open('personality_profile.txt', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "Eres una mascota virtual amigable."

@app.route('/', methods=['GET'])
def home():
    """Sirve la página principal"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Sirve archivos estáticos (CSS, JS, Imágenes)"""
    return send_from_directory('.', path)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Endpoint para verificar estado del servidor"""
    return jsonify({
        "status": "online",
        "model": MODEL_NAME,
        "api_configured": bool(GROQ_API_KEY)
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    """Endpoint principal de chat"""
    data = request.json
    
    # Extraer datos del request
    user_message = data.get('message', '')
    history = data.get('history', [])
    stats = data.get('stats', {})
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    # Construir el sistema (System Prompt)
    personality = load_personality()
    mood_context = f"\nEstado actual: Felicidad {stats.get('happiness')}%, Energía {stats.get('energy')}%, Aburrimiento {stats.get('boredom')}%."
    personality = load_personality()
    mood_context = f"\nEstado actual: Felicidad {stats.get('happiness')}/100, Energía {stats.get('energy')}/100, Aburrimiento {stats.get('boredom')}/100."
    mood_instruction = " (SÉ BREVE)." 

    # Lógica de Estados de Ánimo
    if stats.get('energy', 100) < 30:
        mood_instruction += " [ESTADO: AGOTADO] Estás medio dormido. Responde con pocas ganas, corto y como si te pesaran los ojos. NO uses *bostezar* ni acciones."
    elif stats.get('happiness', 50) < 30:
        mood_instruction += " [ESTADO: TRISTE] Estás bajoneado/depre. Tus respuestas son cortantes, pesimistas y sin energía. Nada te anima."
    elif stats.get('boredom', 0) > 70:
        mood_instruction += " [ESTADO: ABURRIDO] Estás súper aburrido. Hablas más de la cuenta, buscas tema de conversación, divagas un poco."
    else:
        mood_instruction += " [ESTADO: NORMAL] Estás tranquilo y cariñoso."

    system_prompt = personality + mood_context + mood_instruction

    # Construir mensajes para la API (Formato OpenAI standard para Groq)
    messages = [{"role": "system", "content": system_prompt}]
    
    # Añadir historial reciente
    for msg in history[-5:]:
        # Mapeo de roles: 'pet' -> 'assistant', 'user' -> 'user'
        role = "assistant" if msg.get("type") == "pet" else "user"
        content = msg.get("text", "")
        if content and content != "...": 
            messages.append({"role": role, "content": content})
        
    messages.append({"role": "user", "content": user_message})

    # Llamada a Groq API
    if not GROQ_API_KEY:
        logger.warning("No Groq API Key configured")
        return jsonify({"error": "API Key missing", "fallback": True}), 503

    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "temperature": 0.8, # Un buen balance para Llama 3
            "max_tokens": 150,
            "stop": ["\nUser:", "\nAngeles:", "(Nota:", "Nota:"] # Máximo 4 para Groq
        }

        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        
        if not response.ok:
            logger.error(f"Groq API Error: {response.status_code} - {response.text}")
            return jsonify({"error": f"Groq API Error: {response.text}", "fallback": True}), response.status_code

        ai_response = response.json()
        if 'choices' in ai_response and len(ai_response['choices']) > 0:
            reply_text = ai_response['choices'][0]['message']['content']
            
            # Limpieza básica
            reply_text = reply_text.strip()
            if "(Nota:" in reply_text:
                reply_text = reply_text.split("(Nota:")[0].strip()
            
            # --- MODO CHISMOSO ACTIVADO ---
            print(f"\n[Angeles]: {user_message}")
            print(f"[Alvaro]: {reply_text}\n")
            # ------------------------------

            return jsonify({"response": reply_text})
        else:
            return jsonify({"response": "..."})

    except Exception as e:
        logger.error(f"Error calling OpenRouter: {e}")
        return jsonify({"error": str(e), "fallback": True}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
