
const { findAuctions } = require('./list');
const { extractPurse } = require('../info/purse');
const { BMK , sleep, log} = require('../utils')
const fs = require('fs');
const { handleTaxClaim } = require("./taxes")
const { waitForTicks } = require("../events/tick")
const nbt = require('prismarine-nbt');
const zlib = require('zlib');
const { listWithoutTarget } = require("./taxes");
const RELIST_LOSS = 0.96;

async function mainEntry(bot) {
    const { auctions, claimableAuctions, expiredAuctions } = await findAuctions(bot);
    purse = await extractPurse(bot);
    embed = await bot.hook.embed("Ready to Flip!", `# Account Data`,
    "yellow",
    `Eternity | ${purse} Coin Purse`
    );
    let totalWorth = 0;
    for(const auction of auctions) {
        totalWorth += auction.starting_bid;
    }
    bot.stats.activeSlots = auctions.length;
    let claimWorth = 0
    for(const auction of claimableAuctions) {
        claimWorth += auction.starting_bid;
        bot.claimPipeline.push(auction)
    }
    let expiredWorth = 0;
    let tax = 0;
    for (const auction of expiredAuctions) {
        bot.relistPipeline.push(auction)

        // since I don't calculate for new price, lets just assume we lose 4% of original value (0.96)
        const taxIncluded = listWithoutTarget(auction.starting_bid * RELIST_LOSS); // apply the listing tax assuming same price
        const individualItemTax = (auction.starting_bid * RELIST_LOSS) - taxIncluded;
        expiredWorth += taxIncluded;
        tax += individualItemTax;
    }

    embed.addFields(
        { name: 'Auction House', value: `Current Auctions: **${bot.stats.activeSlots}/${bot.stats.totalSlots} (${BMK(totalWorth)})**\nAuctions to Claim: **${claimableAuctions.length} (${BMK(claimWorth)})**\nAuctions to Relist: **${expiredAuctions.length} | Worth: ~${BMK(expiredWorth)} (${BMK(tax)} Tax)**`, inline: false },
        // { name: 'Forge', value: 'WIP', inline: true },
        // { name: 'Kat', value: 'WIP', inline: true },
        // { name: 'Total Profit', value: 'WIP', inline: false }

    );
    await bot.hook.send(embed)
 

    bot.state.emit("addToQueue", "claim")
    bot.state.emit("addToQueue", "relist")

}

async function claimAuction(bot, auction) {
    bot.flayer._client.once('open_window', async (window) => {
        log(`Claiming ${auction.item_name}`, "sys")
        bot.packets.confirmClick(window.windowId)
        if (window.windowTitle === '{"italic":false,"extra":[{"text":"BIN Auction View"}],"text":""}') {
            // log(`Current Window: ${JSON.stringify(bot.flayer.currentWindow, null, 2)}`, "sys")
            if (bot.flayer.currentWindow.slots) {
                    const checkSlot = new Promise((resolve) => {
                        const interval = setInterval(() => {
                            if (bot.flayer.currentWindow.slots[31] !== null) {
                                clearInterval(interval);
                                resolve(bot.flayer.currentWindow.slots[31]);
                            }
                        }, 1);
                    });
                    const slot = await checkSlot;
                    if (!bot.claimCell[auction.item_name]) {
                        bot.claimCell[auction.item_name] = {};
                    } 
                    bot.claimCell[auction.item_name][await handleTaxClaim(auction.highest_bid_amount)] = auction.uuid
                    bot.packets.click(31, window.windowID, 371)
                    bot.betterClick(31, 0, 0)
                    await waitForTicks(bot, 2)
                    let count = 0;
                    while(bot.flayer.currentWindow && count < 2) {
                        bot.betterClick(31, 0, 0)
                        count++;
                        await waitForTicks(bot, 1);
                    }

                    log("Likely clicked on slot 31 during claim", "sys", true)

                    setTimeout(() => {
                        delete bot.claimCell[auction.item_name];
                    }, 3500);
                }
            }
            // this shouldn't pass, only here because i wasnt sure if claim had a confirm window
            else if (window.windowTitle === '{"italic":false,"extra":[{"text":"Confirm Purchase"}],"text":""}') {
                log("Clicking on extra thing?", "warn")
                const checkSlot = new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (bot.flayer.currentWindow.slots[31] !== null) {
                            clearInterval(interval);
                            resolve(bot.flayer.currentWindow.slots[31]);
                        }
                    }, 1);
                    
                });
                const slot = await checkSlot;
                await bot.flayer.waitForTicks(4); 
                bot.packets.click(11, window.windowId, 371)
                bot.betterClick(11, 0, 0);
            }
            else {
                log(`Window not recognized, ${window.windowTitle}`, "sys")
                bot.flayer.closeWindow(window)
            }
        }
    )
    
    bot.chat(`/viewauction ${auction.uuid}`)
    bot.lastAction = Date.now()
}




module.exports = { mainEntry, claimAuction }


// if (window.windowTitle === '{"italic":false,"extra":[{"text":"BIN Auction View"}],"text":""}' & bot.state.getState() === 'claiming') {}
// log("Passed", "sys")
// log(`Current Window: ${JSON.stringify(bot.flayer.currentWindow, null, 2)}`, "sys")
// if (bot.flayer.currentWindow.slots) {
//     log("Passed check of if current window", "sys")
//     let baseString = '';
//     for (let i = 0; i < bot.flayer.currentWindow.slots.length; i++) {
//         await new Promise(resolve => setTimeout(resolve, 350));
//         if (bot.flayer.currentWindow.slots[i] !== null) {
//             baseString += `${JSON.stringify(bot.flayer.currentWindow.slots[i], null, 2)}\n`;
//         }
//         baseString += `passed iter ${i}\n`;
//     }
//     fs.writeFileSync('baseString.json', baseString);
// }