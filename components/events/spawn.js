const { getLocraw } = require('../info/locraw')
const { island } = require('../info/island')
const { restartBot } = require('../events/stall')
const { sleep, log } = require('../utils')
const { mainEntry } = require('../auction/main')
const Socket = require('../socket')

async function onSpawn(bot) {
    bot.flayer.on('spawn', async () => {
        const state = bot.state.getState();
        await sleep(600)
        const locraw = await getLocraw(bot)
        if (locraw?.gametype && locraw?.map && locraw?.gametype === "SKYBLOCK" && locraw?.map === "Private Island") {
            bot.state.setState("waiting");
            await sleep(4000)
            await mainEntry(bot)
            if (bot.socket === null) {
                bot.socket = new Socket(bot);
                bot.socket.open()
            }
            return;
        };

        await sleep(600)
        if(locraw?.server === "limbo") {
            let embed;
            log(`Irregular world change detected, spawned in ${locraw?.server}`, "warn")
            embed = await bot.hook.embed("Irregular World Change", `Irregular world change detected, spawned in ${locraw?.server}\n**No cookie?**`, "red")
            await bot.hook.send(embed)
            bot.state.setState("limbo")
        }
        if(((locraw?.gametype && locraw?.gametype != "SKYBLOCK") || (locraw?.map && locraw?.map != "Private Island")) && state !== "starting" && state !== "traveling") {
            let embed;
            log(`Irregular world change detected, spawned in ${locraw?.gametype}: ${locraw?.map}`, "warn")
            embed = await bot.hook.embed("Irregular World Change", `Irregular world change detected, spawned in ${locraw?.gametype}: ${locraw?.map}`, "red")
            await bot.hook.send(embed)
        }

        await sleep(3000);
        await island(bot, locraw, restartBot);
    })
}

module.exports = { onSpawn }