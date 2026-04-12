const WebSocket = require('ws');
const { log, cleanExit } = require('./utils');
const { BMK, styleText } = require('./helpers');
const EventEmitter = require('events');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { updateConfig, config } = require('../config.js');

class Socket {
    constructor(bot) {
        log(`[Socket] Initializing socket for ${bot.flayer._client.username}`, "sys", true);

        if (process.env.NODE_ENV === "dev") {
            if (config.modSocketID === "") {
                console.error("[Socket] Expected modSocketID in env, please apply before running in dev environment.");
                cleanExit("No modSocketID in .env");
            }
            this.id = process.env.modSocketId;
        } else {
            if (config.modSocketID === "") {
                config.modSocketID = randomUUID();
                updateConfig(config);
                log(`[Socket] Generated new modSocketID: ${config.modSocketID}`, "sys", true);
            }
            this.id = config.modSocketID;
        }

        this.link = `wss://sky.coflnet.com/modsocket?version=1.5.1-af&player=${bot.flayer._client.username}&SId=${this.id}`;
        this.emitter = new EventEmitter();
        this.bot = bot;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;

        log(`[Socket] Socket URL: ${this.link}`, "debug", true);
    }

    connect() {
        try {
            if (this.ws) {
                log("[Socket] Removing existing WebSocket listeners", "debug", true);
                this.ws.removeAllListeners();
            }

            log("[Socket] Connecting to WebSocket...", "sys", true);
            this.ws = new WebSocket(this.link);

            this.ws.on('open', () => {
                log("[Socket] WebSocket connection established", "sys");
                this.reconnectAttempts = 0;
            });

            this.ws.on('message', (response) => {
                try {
                    const msg = JSON.parse(response);
                    const data = JSON.parse(msg.data);

                    switch (msg.type) {
                        case "flip":
                            data.recieveTime = Date.now();
                            log(`[Socket] Flip received: ${data.itemName} @ ${BMK(data.startingBid)}`, "debug", true);

                            this.bot.auctionPipeline.push(data);
                            let state = this.bot.state.getState();

                            if (this.bot.state.getState() !== "processing") {
                                log(`[Socket] Flip case passed | state: ${state}`, "sys", true);
                                this.bot.state.emit("addToQueue", "buy", true);
                            }

                            if (this.bot.waiting) {
                                log("[Socket] Bot is waiting for next flip", "debug", true);
                                this.bot.state.emit("nextFlip");
                            }

                            const cleanName = data.itemName.replace(/§[0-9a-fk-or]/g, '');
                            if (!this.bot.holding[cleanName] || !this.bot.holding[cleanName][data.startingBid]) {
                                this.bot.holding[cleanName] = {};
                                this.bot.holding[cleanName][data.startingBid] = [];
                            }

                            const specificUUID = randomUUID();
                            data.uuid = specificUUID;
                            this.bot.holding[cleanName][data.startingBid].push(data);

                            if (data.tag.slice(0, 3) === "PET") {
                                data.tag = "PET";
                            } else if (data.tag.slice(0, 4) === "RUNE") {
                                data.tag = "RUNE";
                            }

                            if (!this.bot.holding[data.startingBid] || !this.bot.holding[data.startingBid][data.tag]) {
                                this.bot.holding[data.startingBid] = {};
                                this.bot.holding[data.startingBid][data.tag] = [];
                            }
                            this.bot.holding[parseInt(data.startingBid)][data.tag].push({ "type": "Unknown", "tpmTime": 0 });
                            break;

                        case "chatMessage":
                            try {
                                if (data[1] && data[1]["text"]) {
                                    log(styleText(data[0]["text"] + data[1]["text"]), "base");
                                } else {
                                    log(styleText(data[0]["text"]), "base");
                                }
                            } catch (chatError) {
                                log(`[Socket] chatMessage parse error: ${chatError.message}`, "debug", true);
                            }
                            break;

                        case "writeToChat":
                            try {
                                log(styleText(data["text"]), "base");
                            } catch (writeError) {
                                log(`[Socket] writeToChat parse error: ${writeError.message}`, "debug", true);
                            }
                            break;

                        default:
                            log(`[Socket] Unknown message type: ${msg.type}`, "debug", true);
                    }
                } catch (error) {
                    log(`[Socket] Error parsing message: ${error.message}`, "warn");
                    console.error('[Socket] Message parse error:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                log(`[Socket] WebSocket closed. Code: ${code}, Reason: ${reason || 'none'}`, "sys");

                if (this.bot.state.getState() === "reconnecting") {
                    log("[Socket] State is reconnecting, skipping reconnect", "debug", true);
                    return;
                }

                this.attemptReconnect();
            });

            this.ws.on('error', (error) => {
                log(`[Socket] WebSocket error: ${error.message}`, "warn");
                console.error('[Socket] WebSocket error details:', error);
                this.attemptReconnect();
            });

        } catch (error) {
            log(`[Socket] connect() error: ${error.message}`, "warn");
            console.error('[Socket] Connect error:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log(`[Socket] Max reconnect attempts (${this.maxReconnectAttempts}) reached`, "warn");
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        log(`[Socket] Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, "sys");

        setTimeout(() => {
            this.open();
        }, delay);
    }

    open() {
        try {
            log("[Socket] Opening new connection", "sys", true);
            this.disconnect();
            this.connect();
        } catch (error) {
            log(`[Socket] open() error: ${error.message}`, "warn");
        }
    }

    send(msg) {
        try {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(msg);
                log(`[Socket] Message sent: ${msg.type || 'unknown type'}`, "debug", true);
            } else {
                log(`[Socket] Cannot send message, socket not open. State: ${this.ws.readyState}`, "warn");
            }
        } catch (error) {
            log(`[Socket] send() error: ${error.message}`, "warn");
        }
    }

    disconnect() {
        try {
            if (this.ws) {
                log("[Socket] Closing WebSocket connection", "sys", true);
                this.ws.close();
            }
        } catch (error) {
            log(`[Socket] disconnect() error: ${error.message}`, "warn");
        }
    }
}

module.exports = Socket;
