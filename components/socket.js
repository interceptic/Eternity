const WebSocket = require('ws');
const { log, styleText } = require('./utils');
const EventEmitter = require('events');
const { BMK } = require('./utils');
const fs = require('fs');
const { randomUUID } = require('crypto');

class Socket {
    constructor(bot) {
        if(process.env.username) {
            if (process.env.modSocketID === "" || !process.env.modSocketID) {
                console.error("Expected modSocketID in env, please apply before running in dev environment.")
                process.exit(1)
            }
            this.id = process.env.modSocketId;
        } else {
            const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            if (config.modSocketID === "") {
                config.modSocketID = randomUUID();
                this.updateConfig(config);
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
                switch(msg.type) {
                    case "flip": 
                        data.recieveTime = Date.now()
                        // log(JSON.stringify(data, null, 2))
                        this.bot.auctionPipeline.push(data)
                        let state = this.bot.state.getState()
                        if (this.bot.state.getState() !== "processing") {
                            log(`Flip case passed | state: ${state}`, "sys", true)
                            this.bot.state.emit("addToQueue", "buy", true)
                        }
                        if(this.bot.waiting) {
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
                        
                        if(data.tag.slice(0,3) === "PET") {
                            data.tag = "PET";
                        }

                        if(!this.bot.holding[data.startingBid] || !this.bot.holding[data.startingBid][data.tag]) {
                            this.bot.holding[data.startingBid] = {}
                            this.bot.holding[data.startingBid][data.tag] = []
                        }
                        this.bot.holding[data.startingBid][data.tag].push({"type": "Unknown", "tpmTime": 0})
                        // after 15 seconds and flip isnt bought it will remove from array (ONLY IF ALL OTHER CHECKS DONT PASS)
                        setTimeout(() => {
                            try {
                            if (this.bot.holding[cleanName][data.startingBid][0]?.uuid === specificUUID) {
                                this.bot.holding[cleanName][data.startingBid].shift()
                            }
                            } catch (error) {
                                //ignore error
                            }
                            delete this.bot.holding[data.tag];
                        }, 15000);
                        break;
                    case "chatMessage":
                        if (data[1] && data[1]["text"]) {
                            console.log(styleText(data[0]["text"] + data[1]["text"]));
                        } else {
                            console.log(styleText(data[0]["text"]));
                        }
                        break;
                    case "writeToChat":                   
                        console.log(styleText(data["text"]));
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
    // for modsocket ID
    updateConfig(newConfig) {
        const fs = require('fs');
        fs.writeFileSync('./config.json', JSON.stringify(newConfig, null, 2), 'utf8');
    }

    send(msg) {
        this.ws.send(msg)
    }

    disconnect() {
        if (this.ws) {
            this.ws.close()
        }
    }



}
// let sock = new Socket("ikun__kfc")
// sock.connect()


module.exports = Socket