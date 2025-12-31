const { restartBot } = require("./stall")
const { log } = require("../utils")

async function createEnd(bot) {
    // remove prev listeners
    bot.flayer.removeAllListeners('end');
    
    bot.flayer.on('end', async (error) => {
        if(bot.state.getState() === "reconnecting") {
            return; 
        }
        let embed = await bot.hook.embed("Bot Ended", `Bot ended for reason: \`${error}\``, "red")
        await bot.hook.send(embed)
        log(error, "sys")
        await restartBot(bot, "Bot recently ended... check above message")
    });
    
}
module.exports = { createEnd }