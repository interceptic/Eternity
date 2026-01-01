const { createBot } = require("mineflayer");
const { sleep, fetchDelay, log, fetchPing, initOutputHook } = require("./utils");
const { makePackets } = require("./clientPackets");
const { userInfo } = require("./info/user");
const DynamicState = require("./state");
const Webhook = require("./webhook");
const { island, warpMines } = require("./info/island");
const { getLocraw } = require('./info/locraw')
const Socket = require("./socket")
const { buy } = require("./auction/buy");
const fs = require('fs');
const { createListeners } = require("./events/create");
const boughtRegex = /^You purchased (.+?) for ([\d,]+) coins!$/;
const { findAuctions } = require('./auction/list')
const { stall } = require('./events/stall')
const { config } = require('../config.js');




async function handler(username) {
    // object super important
    const bot = await Unit.create(username)
    global.bot = bot;
    
    bot.state.setState("starting")
    await createListeners(bot)
    await initOutputHook(config.notificationHook, bot);

    
    bot.flayer.once('login', async () => {
        log(`Logged in as ${username}`, "debug");
        let embed = await bot.hook.embed(`\`${username}\` Logged in!`, `**Successfully connected to Hypixel!**`, "white");
        embed.setThumbnail(`https://mc-heads.net/head/${bot.info['id']}`)
        await bot.hook.send(embed)
        
        const stallInterval = setInterval(async () => {
            await stall(bot);
        }, 30000); // 30s heartbeat interval
        bot.intervals.push(stallInterval);

        const pingInterval = setInterval(async () => {
            await sleep(60000); // additional grace
            await fetchPing(bot);
        },  15 * 60 * 1000 ); // 15 min interval
        bot.intervals.push(pingInterval); 

        const delayInterval = setInterval(async () => {
            await fetchDelay(bot)
        }, 5 * 60 * 1000) // 5 min interval
        bot.intervals.push(delayInterval); 


    });

    // tpm higher level function click
    bot.betterClick = function (slot, mode1 = 0, mode2 = 0) {
        if (!bot.flayer.currentWindow) {
            return;
        }
        bot.packets.bump();
        bot.flayer.currentWindow.requiresConfirmation = false;
        bot.flayer.clickWindow(slot, mode1, mode2);
    };
}

class Unit {
    constructor(information, flayer) {
        let username = information['name']
        this.flayer = flayer // bot obj
        this.packets = makePackets(flayer._client);
        this.chat = (text) => {
            this.packets.sendMessage(text);
        };
        this.info = information;
        this.state = new DynamicState(this, "starting");
        this.stats = {
            purse: null,
            profit: null,
            exp: null,
            activeSlots: null,
            hourlyProfit: [],  
            totalProfit: 0,    
            totalSlots: null,
            startTime: Date.now(),
            delay: {
                value: 0,
                lastUpdate: Date.now()
            },
            ping: {
                values: [],
                lastUpdate: Date.now()
            }
            
        };
        this.holding = {};
        this.claimCell = {}
        this.relistPipeline = []
        this.claimPipeline = [];
        this.socket = null;
        this.hook = new Webhook(this);
        this.lastAction = Date.now();
        this.stallCalls = 0;
        this.intervals = []; // store interval IDs for cleanup
        this.listIntervals = []
        this.lastTickTime = 0;
        this.auctionPipeline = [];
    }

    static async create(username) {
        const flayer = await newBot(username).catch(error => {
            throw new Error(`Unable to create unit: ${error}`)
        });
        const info = await userInfo(username).catch(error => {
            if (error.response) { // recieved anything from server
                switch (error.response.status) {
                    case 404: {
                        throw new Error("User not found. Please check the username.");
                    }
                    case 500: {
                        throw new Error("Mojang server error. Please try again later.");
                    }
                    default: {
                        throw new Error(`Issue connecting to Mojang API: ${error.message}`);
                    }
                }
            } else if (error.request) {
                throw new Error("No response received from Mojang API. Please check your internet connection.");
            } else {
                throw new Error(`Error in request setup: ${error.message}`);
            }
        });

        return new Unit(info, flayer);
    }
}


async function newBot(username) {
    return new Promise((resolve, reject) => {
    try {
        bot = createBot({
            username: username,
            host: 'mc.hypixel.net',
            port: 25565,
            auth: `microsoft`,
            version: `1.8.9`,
            profilesFolder: `./components/cache/${username}`,
            viewDistance: 'tiny',
            brand: 'vanilla',
            hideErrors: true,
            onMsaCode: (code) => {
                log(`Please login to the microsoft account associated with your minecraft account using the code ${code.user_code} at https://www.microsoft.com/link`, "sys");
            }
        })
        resolve(bot);
        return;
        } catch (error) {
            reject(error);
            return;
        }
    })
}

// never used yayayay, i will make this work later so all my purse logic works at a later date
async function extractInfo(bot) {
    bot.stats.purse = await extractPurse(bot);
}

module.exports = { handler };