const { island } = require('../info/island')
const { getLocraw } = require('../info/locraw')
const { log, sleep } = require("../utils")

async function stall(bot) {
    // assuming bot is ended
    if (bot.state.getState() !== "reconnecting" && bot.flayer._client.ended) {
        log("Bot disconnect found? not caught by normal event... Attempting restart", "sys")
        await restartBot(bot, "Bot disconnect found? not caught by normal event... Attempting restart");
        return;
    }

    // below segment handles stall
    if (Date.now() - bot.lastAction > 900000) { // 15 min no window / action
        if (bot.stallCalls > 0) { // went through the stall checks and issue not fixed
            console.log("Probably stalled - attempting restart...")
            let embed = await bot.hook.embed("Stall Suspected", `${bot.info['name']} hasn't opened a window in the past 15 minutes`, "red")
            await bot.hook.send(embed)
            await restartBot(bot, "Heartbeat detected period of inactivity");
            return;
        }
        try {
            const locraw = await getLocraw(bot)
            await checkLocation(locraw, bot);
            if (!locraw) {
                log("No response from server - attempting restart...", "sys")
                let embed = await bot.hook.embed("No Response From Server", "Attempting a reconnect to hypixel...", "red")
                await bot.hook.send(embed)
                await restartBot(bot, "No response from server when checking locraw")
                return
            }

            if (!bot.flayer.health || bot.flayer.health <= 0) { // might work as a check?
                console.log("Bot health is 0 - likely disconnected")
                let embed = await bot.hook.embed("Bot Dead?", "Bot health is 0, attempting a reconnect", "red")
                await bot.hook.send(embed)
                await restartBot(bot, "Bot health is 0 -- likely disconnected.")
                return
            }

            bot.stallCalls++
        } catch (error) {
            console.error("Error checking stall status:", error) // probably not connected
            await restartBot(bot, "Unable to check stall status.")
            return
        }
    } else {
        // has acted recently, reset timer thing to zero
        bot.stallCalls = 0
    }

    // auction heartbeat
    if ((bot.listPipeline.length > 0 && bot.stats.activeSlots < bot.stats.totalSlots) && bot.state.getState() !== "processing") {
        bot.state.emit("addToQueue", "list")
        return;
    }


    return bot.stallCalls
}

async function restartBot(bot, reason) {
    if (bot.state.getState() !== "reconnecting") {
        log("Restarting bot...", "sys")
        const embed = await bot.hook.embed("Restarting Bot", `**Bot connection is being restarted...**\n\n**Reason:** \`${reason}\``, "red")
        await bot.hook.send(embed)
        bot.state.setState("reconnecting")
        try {
            // Clean up existing connections
            if (bot.socket) {
                bot.socket.disconnect();
                bot.socket = null;
            }

            if (bot.flayer) {
                bot.flayer.quit();
            }

            if (bot.intervals) {
                bot.intervals.forEach(intervalId => {
                    clearInterval(intervalId);
                });
            }

            if (bot.listIntervals) {
                bot.intervals.forEach(intervalId => {
                    clearInterval(intervalId);
                });
            }

            // wait for clean
            await new Promise(resolve => setTimeout(resolve, 4000))
            // restart entire script
            const { handler } = require('../bot')
            // const config = require('../../config.json')
            bot.flayer.removeAllListeners();
            await sleep(4000)
            await handler(bot.flayer._client.username)

        } catch (error) {
            console.error("Error during restart:", error)
            // exit if failure to restart (fixes restart loop)
            process.exit(1)
        }
    }
}


async function checkLocation(locraw, bot) {
    if (locraw?.server === "limbo") {
        bot.state.setState("limbo")
    }
    if (locraw?.gametype !== "SKYBLOCK" || locraw?.gametype === null) {
        await island(bot, locraw, restartBot)
    }
}

module.exports = { stall, restartBot }