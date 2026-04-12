const { restartBot } = require("./stall")
const { log } = require("../utils")

async function createEnd(bot) {
    // remove prev listeners
    bot.flayer.removeAllListeners('end');

    bot.flayer.on('end', async (reason) => {
        log(`[End] Bot ended. Reason: ${reason}`, "sys");
        log(`[End] Current state: ${bot.state.getState()}`, "sys", true);
        log(`[End] Was connected: ${bot.flayer._client?.state || 'unknown'}`, "sys", true);

        if(bot.state.getState() === "reconnecting") {
            log("[End] Already reconnecting, skipping restart", "sys", true);
            return;
        }

        try {
            let embed = await bot.hook.embed("Bot Ended", `Bot ended for reason: \`${reason}\``, "red")
            await bot.hook.send(embed)
        } catch (e) {
            log(`[End] Failed to send webhook: ${e.message}`, "warn");
        }

        await restartBot(bot, `Bot ended with reason: ${reason}`)
    });

    bot.flayer.on('error', (err) => {
        log(`[End] Bot error event: ${err.message}`, "warn");
    });

    log("[End] End event listener registered", "sys", true);
}
module.exports = { createEnd }