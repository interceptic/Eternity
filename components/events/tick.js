async function physicTick(bot) {
    // bot.flayer.on('physicsTick', async () => {
    //         const currentTickTime = Date.now();
    //         // console.log(`Tick duration: ${currentTickTime - bot.lastTickTime}ms`);
    //         bot.lastTickTime = currentTickTime;
    //     })
}

async function waitForTicks(bot, amount) {
    return new Promise((resolve) => {
        let tick = 0;
        const listener = async () => {
            if (tick === amount) {
                bot.flayer.removeListener('physicsTick', listener);
                resolve();
                return;
            }
            tick++;
        };
        bot.flayer.on('physicsTick', listener);
    });
}

module.exports = {physicTick, waitForTicks}