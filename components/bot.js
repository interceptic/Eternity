const { createBot } = require("mineflayer");
const { sleep, fetchDelay, log, fetchPing, initOutputHook } = require("./utils");
const { makePackets } = require("./clientPackets");
const { userInfo } = require("./info/user");
const DynamicState = require("./state");
const Webhook = require("./webhook");
const { island, warpMines } = require("./info/island");
const { getLocraw } = require('./info/locraw');
const Socket = require("./socket");
const { buy } = require("./auction/buy");
const fs = require('fs');
const { createListeners } = require("./events/create");
const boughtRegex = /^You purchased (.+?) for ([\d,]+) coins!$/;
const { findAuctions } = require('./auction/list');
const { stall } = require('./events/stall');
const { config } = require('../config.js');

async function handler(username) {
    log(`[Bot] Starting handler for ${username}`, "sys");

    // Object super important
    let bot;
    try {
        bot = await Unit.create(username);
        global.bot = bot;
        log(`[Bot] Unit created successfully for ${username}`, "sys", true);
    } catch (error) {
        log(`[Bot] CRITICAL: Failed to create Unit: ${error.message}`, "warn");
        console.error('[Bot] Unit creation error:', error);
        throw error;
    }

    bot.state.setState("starting");
    await createListeners(bot);
    await initOutputHook(config.notificationHook, bot);

    // Login event setup
    bot.flayer.once('login', async () => {
        try {
            log(`[Bot] Logged in as ${username}`, "debug");

            let embed = await bot.hook.embed(`\`${username}\` Logged in!`, `**Successfully connected to Hypixel!**`, "white");
            embed.setThumbnail(`https://mc-heads.net/head/${bot.info['id']}`);
            await bot.hook.send(embed);

            const stallInterval = setInterval(async () => {
                try {
                    await stall(bot);
                } catch (error) {
                    log(`[Bot] Stall check error: ${error.message}`, "warn");
                }
            }, 30000); // 30s heartbeat interval
            bot.intervals.push(stallInterval);

            const pingInterval = setInterval(async () => {
                try {
                    await sleep(60000); // Additional grace
                    await fetchPing(bot);
                } catch (error) {
                    log(`[Bot] Ping fetch error: ${error.message}`, "warn");
                }
            }, 15 * 60 * 1000); // 15 min interval
            bot.intervals.push(pingInterval);

            const delayInterval = setInterval(async () => {
                try {
                    await fetchDelay(bot);
                } catch (error) {
                    log(`[Bot] Delay fetch error: ${error.message}`, "warn");
                }
            }, 5 * 60 * 1000); // 5 min interval
            bot.intervals.push(delayInterval);

            log(`[Bot] All intervals registered`, "sys", true);
        } catch (error) {
            log(`[Bot] Login handler error: ${error.message}`, "warn");
            console.error('[Bot] Login error:', error);
        }
    });

    // Click a slot in the current window. Uses raw packet to avoid
    // HashedSlot serialization failures from upstream SlotComponent bugs.
    bot.betterClick = function (slot, mode1 = 0, mode2 = 0) {
        try {
            const win = bot.flayer.currentWindow;
            if (!win) return;
            bot.packets.click(slot, win.id);
        } catch (error) {
            log(`[Bot] betterClick error: ${error.message}`, "warn");
        }
    };
}

class Unit {
    constructor(information, flayer) {
        let username = information['name'];
        this.flayer = flayer; // Bot obj
        this.packets = makePackets(flayer._client, this);
        this.chat = (text) => {
            // Use mineflayer's chat method which handles 1.19+ signing
            try {
                this.flayer.chat(text);
                log(`[Bot] Chat sent: ${text}`, "debug", true);
            } catch (error) {
                log(`[Bot] Chat error: ${error.message}`, "warn");
                // Fallback to packet method
                this.packets.sendMessage(text);
            }
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
        this.claimCell = {};
        this.relistPipeline = [];
        this.claimPipeline = [];
        this.socket = null;
        this.hook = new Webhook(this);
        this.lastAction = Date.now();
        this.stallCalls = 0;
        this.intervals = []; // Store interval IDs for cleanup
        this.listIntervals = [];
        this.lastTickTime = 0;
        this.auctionPipeline = [];

        log(`[Bot] Unit initialized for ${username}`, "sys", true);
    }

    static async create(username) {
        log(`[Bot] Creating Unit for ${username}`, "sys", true);

        const flayer = await newBot(username).catch(error => {
            log(`[Bot] CRITICAL: newBot failed: ${error.message}`, "warn");
            console.error('[Bot] newBot error:', error);
            throw new Error(`Unable to create unit: ${error}`);
        });

        const info = await userInfo(username).catch(error => {
            log(`[Bot] User info fetch error: ${error.message}`, "warn");
            if (error.response) {
                switch (error.response.status) {
                    case 404:
                        throw new Error("User not found. Please check the username.");
                    case 500:
                        throw new Error("Mojang server error. Please try again later.");
                    default:
                        throw new Error(`Issue connecting to Mojang API: ${error.message}`);
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
        log(`[Bot] Creating mineflayer bot for ${username}`, "sys", true);
        log(`[Bot] Target: mc.hypixel.net:25565, version: 1.21.11`, "sys", true);

        try {
            const bot = createBot({
                username: username,
                host: 'mc.hypixel.net',
                port: 25565,
                auth: 'microsoft',
                version: '1.21.11',
                profilesFolder: `./components/cache/${username}`,
                viewDistance: 'tiny',
                brand: 'vanilla',
                hideErrors: true,
                keepAlive: true,
                checkTimeoutInterval: 30000,
                onMsaCode: (code) => {
                    log(`[Bot] MSA Authentication required!`, "sys");
                    log(`[Bot] Please login using code ${code.user_code} at https://www.microsoft.com/link`, "sys");
                    console.log(`\n=== MICROSOFT LOGIN ===`);
                    console.log(`Code: ${code.user_code}`);
                    console.log(`URL: https://www.microsoft.com/link`);
                    console.log(`========================\n`);
                }
            });

            // Patch protodef streams: the default _transform calls cb(error) on
            // failures, which DESTROYS the stream in Node.js readable-stream.
            // A single bad packet kills all subsequent traffic (including keep-alive).
            // Fix: skip the bad packet and call cb() to keep the stream alive.
            function patchStreams(client) {
                client.deserializer._transform = function (chunk, enc, cb) {
                    let packet;
                    try {
                        packet = this.parsePacketBuffer(chunk);
                    } catch (e) {
                        return cb();
                    }
                    this.push(packet);
                    return cb();
                };
                client.serializer._transform = function (chunk, enc, cb) {
                    let buf;
                    try {
                        buf = this.createPacketBuffer(chunk);
                    } catch (e) {
                        e.field = `${client.protocolState}.${client.isServer ? 'toClient' : 'toServer'}`;
                        e.message = `Serialization error for ${e.field} : ${e.message}`;
                        client.emit('error', e);
                        return cb();
                    }
                    this.push(buf);
                    return cb();
                };
            }
            patchStreams(bot._client);
            bot._client.on('state', () => {
                patchStreams(bot._client);
            });


            // Patch _signedChat to use random salt instead of hardcoded 1n.
            // Hypixel rejects commands with constant salt values.
            const crypto = require('crypto');
            bot._client.once('playerJoin', () => {
                const origSignedChat = bot._client._signedChat;
                if (origSignedChat) {
                    bot._client._signedChat = (message, options = {}) => {
                        options.salt = options.salt || crypto.randomBytes(8).readBigInt64BE();
                        return origSignedChat(message, options);
                    };
                    bot._client.chat = bot._client._signedChat;
                }
            });

            // Fix for mineflayer #3623: Hypixel requires the client to send
            // a 'settings' packet immediately upon entering configuration state.
            // minecraft-protocol doesn't do this, so Hypixel drops the connection.
            bot._client.on('state', (newState) => {
                if (newState === 'configuration') {
                    bot._client.write('settings', {
                        locale: 'en_us',
                        viewDistance: 2,
                        chatFlags: 0,
                        chatColors: true,
                        skinParts: 127,
                        mainHand: 1,
                        enableTextFiltering: false,
                        enableServerListing: false,
                        particleStatus: 'all'
                    });
                    log(`[Bot] Sent configuration settings packet`, "sys", true);
                }
            });

            // Handle cookie requests: Hypixel sends cookie_request packets
            // during both configuration and play states. If the client doesn't
            // respond, Hypixel puts the bot in limbo with no command access.
            const cookieStore = {};
            bot._client.on('cookie_request', (data) => {
                const key = data.cookie || data.key;
                log(`[Bot] Cookie requested: ${key}`, "sys", true);
                bot._client.write('cookie_response', {
                    key: key,
                    value: cookieStore[key] || null
                });
            });
            bot._client.on('store_cookie', (data) => {
                cookieStore[data.key] = data.value;
                log(`[Bot] Cookie stored: ${data.key} (${data.value?.length || 0} bytes)`, "sys", true);
            });

            bot._client.on('error', (error) => {
                if (error.message?.includes('Serialization error')) {
                    log(`[Bot] Serialization error: ${error.message}`, "debug", true);
                    return;
                }
                log(`[Bot] Client error: ${error.message}`, "warn");
            });

            bot.on('error', (error) => {
                log(`[Bot] Mineflayer error: ${error.message}`, "warn");
            });

            bot._client.on('end', (reason) => {
                log(`[Bot] _client end event: ${reason}`, "warn");
            });

            bot._client.on('connect', () => {
                log(`[Bot] _client connected to server`, "sys");
            });

            bot._client.on('success', (packet) => {
                log(`[Bot] Login successful: ${packet.username}`, "sys");
            });

            bot.once('spawn', () => {
                log(`[Bot] Spawned in world`, "sys");
            });

            bot.on('end', (reason) => {
                log(`[Bot] Connection ended. Reason: ${reason}`, "warn");
            });

            resolve(bot);
            return;
        } catch (error) {
            log(`[Bot] CRITICAL: Bot creation failed: ${error.message}`, "warn");
            console.error('[Bot] Bot creation error:', error);
            reject(error);
            return;
        }
    });
}

// Never used - kept for future purse logic
async function extractInfo(bot) {
    try {
        bot.stats.purse = await extractPurse(bot);
    } catch (error) {
        log(`[Bot] extractInfo error: ${error.message}`, "warn");
    }
}

module.exports = { handler };
