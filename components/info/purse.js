async function extractPurse(bot) {
    let purse;
    let scoreboard = bot.flayer?.scoreboard?.sidebar?.items?.map(item => item?.displayName?.getText(null)?.replace(item?.name, ''));
    scoreboard?.forEach(e => {
        if (e.includes('Purse:') || e.includes('Piggy:')) {
            let purseString = e.substring(e.indexOf(':') + 1).trim();
            if (purseString.includes('(')) purseString = purseString.split('(')[0];
            purse = parseInt(purseString.replace(/\D/g, ''), 10);
        }
    });
    return purse;
}

module.exports = { extractPurse }