const { sleep, log } = require("../utils");
// Updated to 1.21.1 for compatibility with 1.21.11
// Note: minecraft-data may not have exact 1.21.11, use closest available
let mcData;
try {
    mcData = require('minecraft-data')('1.21.1');
    log("[Island] Loaded minecraft-data for 1.21.1", "sys", true);
} catch (err) {
    try {
        mcData = require('minecraft-data')('1.20.4');
        log("[Island] Fallback to minecraft-data 1.20.4", "sys", true);
    } catch (err2) {
        mcData = require('minecraft-data')('1.20');
        log("[Island] Fallback to minecraft-data 1.20", "warn");
    }
}

const { getLocraw } = require('./locraw');

async function island(bot, locraw, restartFunction) {
    return new Promise(async (resolve) => {
        try {
            log(`[Island] island() called with locraw: ${JSON.stringify(locraw)}`, "sys", true);

            if (bot.state.getState() === "limbo") {
                log("[Island] State is limbo, sending /l command", "sys", true);
                bot.state.setState("traveling");
                bot.chat("/l");
                resolve();
                return;
            }

            // Check if it tries to join but is kicked / unable
            const messageListener = async (message, position) => {
                try {
                    if (position === "game_info") return;

                    const msgText = message.toAnsi().toLowerCase();
                    if (msgText.includes('kicked') ||
                        msgText.includes('problem') ||
                        msgText.includes("cannot join") ||
                        msgText.includes("try again")) {

                        log(`[Island] Join issue detected: ${msgText}`, "warn");
                        bot.flayer.removeListener('message', messageListener);
                        await sleep(2500);
                        await restartFunction(bot, message.toAnsi().replace(/\x1b\[[0-9;]*m/g, ''));
                        return;
                    }
                } catch (error) {
                    log(`[Island] Message listener error: ${error.message}`, "warn");
                }
            };

            bot.flayer.on('message', messageListener);
            bot.state.setState("traveling");
            await sleep(600);

            if (locraw?.gametype === "SKYBLOCK" && locraw?.map !== "Private Island") {
                log("[Island] In Skyblock but not on island, warping", "sys", true);
                bot.chat('/warp island');
            } else if (locraw?.gametype !== "SKYBLOCK") {
                log("[Island] Not in Skyblock, joining", "sys", true);
                await sleep(350);
                bot.chat("/skyblock");
            }

            setTimeout(() => {
                bot.flayer.removeListener('message', messageListener);
            }, 2500);

            resolve();

        } catch (error) {
            log(`[Island] island() error: ${error.message}`, "warn");
            console.error('[Island] island full error:', error);
            resolve();
        }
    });
}

async function warpMines(bot) {
    try {
        log("[Island] warpMines called", "sys", true);
        await sleep(2000);
        bot.chat('/skyblock');

        bot.flayer.on('spawn', async () => {
            try {
                await sleep(3000);
                bot.state.setState('traveling');
                bot.chat('/warp crystals');
                await sleep(2000);
                let location = await getLocraw(bot);
                log(`[Island] Location after warp: ${JSON.stringify(location)}`, "sys", true);
                sleep(100);
            } catch (error) {
                log(`[Island] warpMines spawn handler error: ${error.message}`, "warn");
            }
        });
    } catch (error) {
        log(`[Island] warpMines error: ${error.message}`, "warn");
    }
}

module.exports = { island, warpMines };
