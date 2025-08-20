const { sleep } = require("../utils");
const mcData = require('minecraft-data')('1.8.9')
const {restartBot} = require('../events/stall')
const { getLocraw } = require('./locraw')


async function island(bot, locraw) {
    return new Promise(async (resolve) => {
        if(bot.state.getState() === "limbo") {
            bot.state.setState("traveling")
            bot.chat("/l")
            resolve();
            return;
        }
        
        // check if it tries to join but is kicked / unable
        const messageListener = async (message, position) => {
            if (position === "game_info") return;
            if (message.toAnsi().toLowerCase().includes('kicked') 
                || message.toAnsi().toLowerCase().includes('problem') 
                || message.toAnsi().toLowerCase().includes("cannot join")) {
                bot.flayer.removeListener('message', messageListener);
                await sleep(2500)
                await restartBot(bot, message.toAnsi().replace(/\x1b\[[0-9;]*m/g, ''));
                return;
            }
        };



        bot.flayer.on('message', messageListener);
        bot.state.setState("traveling")
        await sleep(600)
        if(locraw?.gametype === "SKYBLOCK" && locraw?.map != "Private Island") {
            bot.chat('/warp island');
        } else if(locraw?.gametype != "SKYBLOCK") {
            await sleep(350)
            bot.chat("/skyblock")
        }
        setTimeout( () => {
            bot.flayer.removeListener('message', messageListener);
        }, 2500);
            // console.log(location);
        resolve();

    })
}

async function warpMines(bot) {
    await sleep(2000); 
    bot.chat('/skyblock')

    bot.flayer.on('spawn' , async () => {
        await sleep(3000);
        bot.state.setState('traveling');
        bot.chat('/warp crystals');
        await sleep(2000)
        let location = await getLocraw(bot);
        console.log(location)
        // if(location.map == "Hub") {
        // bot.state.setState('```Traveling to Mines```');
        // send(`Spawned in ${location.map}`, `Current State: ${bot.state.state}\n Last Action: ${bot.state.lastAction}`);
        // await sleep(4000);
        // }
        sleep(100)
        })
}




module.exports = { island, warpMines };