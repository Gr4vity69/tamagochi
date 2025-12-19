class TamagotchiIA {
    constructor() {
        this.stats = {
            happiness: 98,
            energy: 50,
            boredom: 10
        };

        // Sprite Config
        this.spriteState = 'normal';
        this.frame = 1;
        this.spriteInterval = null;
        this.forcedSpriteUntil = 0; // Timestamp to keep a sprite forced

        // Physics State
        this.physics = {
            active: false,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            animationId: null
        };

        // Load State
        const savedState = this.loadState();
        if (savedState) this.stats = savedState;

        // DOM Elements
        this.elements = {
            sprite: document.getElementById('pet-sprite'),
            moodText: document.getElementById('mood-text'),
            valHappy: document.getElementById('val-happy'),
            valBored: document.getElementById('val-bored'),
            valEnergy: document.getElementById('val-energy'),
            chatOverlay: document.getElementById('chat-overlay'),
            input: document.getElementById('chat-input'),
            sendBtn: document.getElementById('btn-send'),
            // Controls
            btnPlay: document.getElementById('btn-play'),
            btnPet: document.getElementById('btn-pet'),
            btnSleep: document.getElementById('btn-sleep'),
            // World
            gameWorld: document.querySelector('.game-world'),
            gameScreen: document.querySelector('.game-screen'),
            ball: document.getElementById('game-ball'),
            // Hidden history
            chatHistory: document.getElementById('chat-history')
        };

        this.init();
        this.startSpriteAnimation();
    }

    init() {
        // Game Loop
        setInterval(() => this.gameLoop(), 5000);
        setInterval(() => this.updateSpriteImage(), 500);

        this.setupEventListeners();
        this.updateUI();
        this.updateSpriteLogic();
    }

    loadState() {
        const saved = localStorage.getItem('tamagotchi_state');
        return saved ? JSON.parse(saved) : null;
    }

    saveState() {
        localStorage.setItem('tamagotchi_state', JSON.stringify(this.stats));
    }

    gameLoop() {
        // Natural decay / changes
        this.updateStat('boredom', 0.5);

        this.updateSpriteLogic();
        this.updateUI();
        this.saveState();
    }

    updateStat(statName, value) {
        this.stats[statName] = Math.max(0, Math.min(100, this.stats[statName] + value));
        this.updateUI();
        this.updateSpriteLogic();
    }

    // --- ACTIONS ---
    pet() {
        this.updateStat('happiness', 10);
        this.forceSpriteState('happy', 2000);
        this.forceMoodText("FELIZ");
    }

    play() {
        if (this.stats.energy < 20) {
            this.renderChatBubble("Estoy muy cansado...", "ai");
            this.forceMoodText("CANSADO");
            return;
        }

        this.updateStat('boredom', -20);
        this.updateStat('energy', -10);
        this.updateStat('happiness', 5);

        this.forceSpriteState('happy', 4000);
        this.forceMoodText("JUGANDO");

        // Start Physics Ball
        this.startBallPhysics(4000);

        // Request a curious fact
        this.getAIResponse("[ACCION_PLAY: Cuenta un dato curioso corto]");
    }

    sleep() {
        this.updateStat('energy', 30);
        this.updateStat('boredom', -5);
        this.forceSpriteState('tired', 3000);
        this.renderChatBubble("Zzz...", "ai");
        this.forceMoodText("DURMIENDO");
    }

    // --- PHYSICS ENGINE (BALL) ---
    startBallPhysics(duration) {
        if (this.physics.active) return;

        const ball = this.elements.ball;
        const screen = this.elements.gameScreen;
        if (!ball || !screen) return;

        this.physics.active = true;
        ball.style.display = 'block';

        // Initial Random Position & Velocity
        const wWidth = screen.clientWidth;
        const wHeight = screen.clientHeight;

        this.physics.x = wWidth / 2;
        this.physics.y = wHeight / 2;
        this.physics.vx = (Math.random() - 0.5) * 12;
        this.physics.vy = (Math.random() - 0.5) * 12;

        const loop = () => {
            if (!this.physics.active) return;

            // Move
            this.physics.x += this.physics.vx;
            this.physics.y += this.physics.vy;

            // Bounce on boundaries
            const bWidth = ball.offsetWidth || 32;
            const bHeight = ball.offsetHeight || 32;

            if (this.physics.x <= 0) {
                this.physics.x = 0;
                this.physics.vx *= -1;
            } else if (this.physics.x >= wWidth - bWidth) {
                this.physics.x = wWidth - bWidth;
                this.physics.vx *= -1;
            }

            if (this.physics.y <= 0) {
                this.physics.y = 0;
                this.physics.vy *= -1;
            } else if (this.physics.y >= wHeight - bHeight) {
                this.physics.y = wHeight - bHeight;
                this.physics.vy *= -1;
            }

            // Apply
            ball.style.left = `${Math.round(this.physics.x)}px`;
            ball.style.top = `${Math.round(this.physics.y)}px`;

            this.physics.animationId = requestAnimationFrame(loop);
        };

        this.physics.animationId = requestAnimationFrame(loop);

        // End after duration
        setTimeout(() => {
            this.physics.active = false;
            cancelAnimationFrame(this.physics.animationId);
            ball.style.display = 'none';
        }, duration);
    }

    // --- SPRITE LOGIC ---
    startSpriteAnimation() {
        if (this.spriteInterval) clearInterval(this.spriteInterval);
        this.spriteInterval = setInterval(() => {
            this.frame = this.frame === 1 ? 2 : 1;
            this.updateSpriteImage();
        }, 500);
    }

    forceSpriteState(state, duration) {
        this.spriteState = state;
        this.forcedSpriteUntil = Date.now() + duration;
        this.updateSpriteImage();

        // Return to normal logic after duration
        setTimeout(() => this.updateSpriteLogic(), duration);
    }

    updateSpriteLogic() {
        // If we are currently in a forced state (e.g. playing/petting), don't change
        if (Date.now() < this.forcedSpriteUntil) return;

        // Determine state based on stats
        let mood = "NORMAL";
        if (this.stats.energy <= 30) {
            this.spriteState = 'tired';
            mood = "CANSADO";
        } else if (this.stats.happiness <= 30) {
            this.spriteState = 'sad';
            mood = "TRISTE";
        } else if (this.stats.boredom >= 70) {
            this.spriteState = 'bored';
            mood = "ABURRIDO";
        } else {
            this.spriteState = 'normal';
            mood = "NORMAL";
        }

        if (this.elements.moodText) this.elements.moodText.innerText = mood;
    }

    forceMoodText(text) {
        if (this.elements.moodText) this.elements.moodText.innerText = text;
    }

    updateSpriteImage() {
        if (!this.elements.sprite) return;
        this.elements.sprite.src = `pet-sprites/${this.spriteState}_${this.frame}.png`;
    }

    updateUI() {
        if (this.elements.valHappy) this.elements.valHappy.innerText = Math.round(this.stats.happiness) + "%";
        if (this.elements.valBored) this.elements.valBored.innerText = Math.round(this.stats.boredom) + "%";
        if (this.elements.valEnergy) this.elements.valEnergy.innerText = Math.round(this.stats.energy) + "%";
    }

    // --- CHAT SYSTEM ---
    setupEventListeners() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.handleUserMessage());
        }
        if (this.elements.input) {
            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleUserMessage();
            });
        }
        if (this.elements.btnPlay) this.elements.btnPlay.addEventListener('click', () => this.play());
        if (this.elements.btnPet) this.elements.btnPet.addEventListener('click', () => this.pet());
        if (this.elements.btnSleep) this.elements.btnSleep.addEventListener('click', () => this.sleep());
    }

    handleUserMessage() {
        const text = this.elements.input.value.trim();
        if (!text) return;
        this.renderChatBubble(text, 'user');
        this.logHistory(text, 'user');
        this.elements.input.value = '';
        this.getAIResponse(text);
    }

    renderChatBubble(text, type) {
        if (type === 'ai') {
            const aiBubbles = this.elements.chatOverlay.querySelectorAll('.chat-bubble.ai');
            aiBubbles.forEach(b => b.remove());
        }

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${type}`;
        bubble.innerText = text;
        this.elements.chatOverlay.appendChild(bubble);

        if (type === 'user') {
            const userBubbles = this.elements.chatOverlay.querySelectorAll('.chat-bubble.user');
            if (userBubbles.length > 2) userBubbles[0].remove();
            setTimeout(() => {
                if (bubble.parentElement) {
                    bubble.style.animation = 'fadeOut 1s forwards';
                    setTimeout(() => bubble.remove(), 1000);
                }
            }, 20000);
        } else if (type === 'ai') {
            setTimeout(() => {
                if (bubble.parentElement) {
                    bubble.style.animation = 'fadeOut 1s forwards';
                    setTimeout(() => bubble.remove(), 1000);
                }
            }, 30000);
        }
    }

    logHistory(text, type) {
        const historyDiv = this.elements.chatHistory;
        if (historyDiv) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${type}`;
            msgDiv.innerText = text;
            historyDiv.appendChild(msgDiv);
        }

        if (type !== 'system') {
            if (!this.chatHistoryLog) this.chatHistoryLog = [];
            this.chatHistoryLog.push({ type, text });
            if (this.chatHistoryLog.length > 20) this.chatHistoryLog.shift();
        }
    }

    async getAIResponse(input) {
        this.updateStat('happiness', 5);
        this.updateStat('boredom', -5);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    history: this.chatHistoryLog || [],
                    stats: this.stats
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const reply = data.response || "...";

            this.renderChatBubble(reply, 'ai');
            this.logHistory(reply, 'model');

            // Only force happy if we're not already playing/forcing
            if (Date.now() > this.forcedSpriteUntil) {
                this.forceSpriteState('happy', 3000);
            }

        } catch (error) {
            console.error(error);
            this.renderChatBubble("... (error)", 'ai');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new TamagotchiIA();
});
