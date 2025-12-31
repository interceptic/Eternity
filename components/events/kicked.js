
async function onKick(bot) {
    // remove prev listeners
    bot.flayer.removeAllListeners('kicked');
    
    bot.flayer.on('kicked', async (reason) => {
        reason = JSON.parse(reason).extra.map((element) => { return element.text });
        const embed = await bot.hook.embed("Bot Kicked", `${reason}`, "red")
        await bot.hook.send(embed)
    })
}

module.exports = {onKick}