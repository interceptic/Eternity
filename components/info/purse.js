async function extractPurse(bot, type = null, boughtPrice = null) {
    let purse;
    let scoreboard = bot.flayer?.scoreboard?.sidebar?.items?.map(item => item?.displayName?.getText(null)?.replace(item?.name, ''));
    scoreboard?.forEach(e => {
        if (e.includes('Purse:') || e.includes('Piggy:')) {
            let purseString = e.substring(e.indexOf(':') + 1).trim();
            if (purseString.includes('(')) purseString = purseString.split('(')[0];
            purse = parseInt(purseString.replace(/\D/g, ''), 10);
        }
    });
    if(purse === bot.stats.purse && type === "boughtItem") {
        if (auction !== null) {
            purse = purse - boughtPrice;
        }
   }
    return purse;
}

module.exports = { extractPurse }