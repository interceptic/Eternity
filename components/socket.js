const WebSocket = require('ws');
const { log, styleText } = require('./utils');
const EventEmitter = require('events');
const { BMK, cleanExit } = require('./utils');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { updateConfig, config } = require('../config.js');

class Socket {
    constructor(bot) {
        if (process.env.NODE_ENV === "dev") {
            if (config.modSocketID === "") {
                console.error("Expected modSocketID in env, please apply before running in dev environment.")
                cleanExit("No modSocketID in .env")
            }
            this.id = process.env.modSocketId;
        } else {
            if (config.modSocketID === "") {
                config.modSocketID = randomUUID();
                updateConfig(config);
            }
            this.id = config.modSocketID;
        }
        this.link = `wss://sky.coflnet.com/modsocket?version=1.5.1-af&player=${bot.flayer._client.username}&SId=${this.id}` //autoflipper socket
        this.emitter = new EventEmitter();
        this.bot = bot;
    }
    connect() {
        this.ws = new WebSocket(this.link); //autoflipper socket   
        this.ws.on('message', (response) => {
            // convert buffer to string and parse JSON
            try {
                // sometimes doesnt recieve binary buffer weird
                const msg = JSON.parse(response);
                const data = JSON.parse(msg.data)
                switch (msg.type) {
                    case "flip":
                        data.recieveTime = Date.now()
                        // log(JSON.stringify(data, null, 2))
                        this.bot.auctionPipeline.push(data)
                        let state = this.bot.state.getState()
                        if (this.bot.state.getState() !== "processing") {
                            log(`Flip case passed | state: ${state}`, "sys", true)
                            this.bot.state.emit("addToQueue", "buy", true)
                        }

                        if (this.bot.waiting) {
                            log("bot is considered to be waiting for next flip", "debug", true)
                            this.bot.state.emit("nextFlip");
                        }

                        const cleanName = data.itemName.replace(/§[0-9a-fk-or]/g, '');
                        if (!this.bot.holding[cleanName] || !this.bot.holding[cleanName][data.startingBid]) {
                            this.bot.holding[cleanName] = {};
                            this.bot.holding[cleanName][data.startingBid] = [];
                        }

                        const specificUUID = randomUUID();
                        data.uuid = specificUUID;
                        this.bot.holding[cleanName][data.startingBid].push(data)

                        if (data.tag.slice(0, 3) === "PET") {
                            data.tag = "PET";
                        } else if (data.tag.slice(0, 4) === "RUNE") {
                            data.tag = "RUNE";
                        }

                        if (!this.bot.holding[data.startingBid] || !this.bot.holding[data.startingBid][data.tag]) {
                            this.bot.holding[data.startingBid] = {}
                            this.bot.holding[data.startingBid][data.tag] = []
                        }
                        this.bot.holding[parseInt(data.startingBid)][data.tag].push({"type": "Unknown", "tpmTime": 0})
                        // after 15 seconds and flip isnt bought it will remove from array (ONLY IF ALL OTHER CHECKS DONT PASS)
                        // setTimeout(() => {
                        //     try {
                        //     if (this.bot.holding[cleanName][data.startingBid][0]?.uuid === specificUUID) {
                        //         this.bot.holding[cleanName][data.startingBid].shift()
                        //     }
                        //     } catch (error) {
                        //         //ignore error
                        //     }
                        //     delete this.bot.holding[data.tag];
                        // }, 15000);
                        break;
                    case "chatMessage":
                        if (data[1] && data[1]["text"]) {
                            log(styleText(data[0]["text"] + data[1]["text"]), "base")
                        } else {
                            log(styleText(data[0]["text"]), "base");
                        }
                        break;
                    case "writeToChat":
                        log(styleText(data["text"]), "base");
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        this.ws.on('close', () => {
            log('WebSocket connection closed. Attempting to reconnect...', "sys");
            if (this.bot.state.getState() === "reconnecting") { // state flag to prevent multiple connections
                return;
            }
            this.open();
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.open();
        });

    }

    open() {
        this.disconnect()
        this.connect()
    }

    send(msg) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(msg)
        } else {
            console.warn(`Socket not open, skipping message ${msg.type || ""}`);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close()
        }
    }

}

module.exports = Socket