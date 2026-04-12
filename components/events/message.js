const boughtRegex = /^You purchased (.+?) for ([\d,]+) coins!$/;
const claimRegex = /You collected ([\d,]+) coins from selling (.+?) to (.+?) in an auction!/;
const fs = require('fs');
const { config } = require('../../config.js');
const { sleep, log, updateStats } = require("../utils");
const { BMK } = require("../helpers");
const { handleTaxList, handleTaxClaim } = require('../auction/taxes');
const soldRegex = /^\[Auction\] (.+?) bought (.+?) for ([\d,]+) coins CLICK$/;
const { claimAuction } = require("../auction/main");
const { extractPurse } = require('../info/purse');
const { claimItem } = require('../auction/list.js');
const listRegex = /^(.+?) created (.+?) for (.+?) at ([\d,]+) coins!$/;
const listRegex2 = /^(.+?) listed (.+?) for (.+?) at ([\d,]+) coins!$/;

function addOrdinalSuffix(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}

async function createMessageEvent(bot) {
    log("[Message] Registering message event listener", "sys", true);

    bot.flayer.on('message', async (message, position) => {
        try {
            if (position === "game_info") return;

            const messageString = typeof message === 'string' ? message : message.toString();
            if (messageString.startsWith('{') && messageString.endsWith('}')) return;

            // Converts the message to readable color codes and prints to console
            try {
                log(message.toAnsi());
            } catch (ansiError) {
                log(`[Message] toAnsi error: ${ansiError.message}`, "debug", true);
                log(messageString);
            }

            handleMessageEvent(message, bot);
        } catch (error) {
            log(`[Message] Message event handler error: ${error.message}`, "warn");
            console.error('[Message] Handler error:', error);
        }
    });
}

async function handleMessageEvent(message, bot) {
    try {
        const time = Date.now();
        let event;

        try {
            event = message.toAnsi().toLowerCase();
        } catch (e) {
            event = message.toString().toLowerCase();
        }

        // Base text
        let string;
        try {
            string = message.getText ? message.getText(null) : message.toString();
        } catch (e) {
            string = message.toString();
        }

        // Claim message handler
        const claim = string.match(claimRegex);
        if (claim) {
            try {
                log("[Message] Claim message received", "debug", true);
                log(`[Message] claimCell: ${JSON.stringify(bot.claimCell)}`, "debug", true);

                const price = claim[1];
                const itemName = claim[2];
                const username = claim[3];

                let embed = await bot.hook.embed(
                    "Claimed Sold Item!",
                    `Collected \`${price} coins\` for selling \`${itemName}\` to \`${username}\` [(click)](https://sky.coflnet.com/auction/${bot.claimCell[itemName]?.[price.replace(/,/g, '')] || 'unknown'})`,
                    "blue"
                );

                bot.stats.activeSlots--;
                await new Promise(resolve => setTimeout(resolve, 1200));

                const purse = await extractPurse(bot);
                embed.setFooter({
                    text: `Eternity | ${BMK(purse, 1)} Coin Purse`,
                    iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&"
                });
                await bot.hook.send(embed);
            } catch (claimError) {
                log(`[Message] Claim handler error: ${claimError.message}`, "warn");
            }
        }

        // Sold message handler
        const soldMatch = string.match(soldRegex);
        if (soldMatch) {
            try {
                const item = soldMatch[2];
                const price = soldMatch[3];
                const clickEvent = message?.clickEvent?.value;
                const auctionID = clickEvent ? clickEvent.replace('/viewauction ', '').replace(/-/g, '') : 'unknown';

                log(`[Message] Sold match: ${item} for ${price}`, "debug", true);

                const auction = {
                    "item_name": item,
                    "highest_bid_amount": price.replace(/,/g, ''),
                    "uuid": auctionID
                };

                if (!bot.claimPipeline) {
                    bot.claimPipeline = [];
                }
                bot.claimPipeline.push(auction);
                await bot.state.emit("addToQueue", "claim");
            } catch (soldError) {
                log(`[Message] Sold handler error: ${soldError.message}`, "warn");
            }
        }

        // Bought message handler
        const bought = string.match(boughtRegex);
        if (bought) {
            try {
                const itemName = bought[1];
                const boughtPrice = bought[2].replace(/,/g, '');

                log(`[Message] Bought: ${itemName} for ${boughtPrice}`, "debug", true);

                if (!bot.holding[itemName] || !bot.holding[itemName][boughtPrice] || !bot.holding[itemName][boughtPrice][0]) {
                    log(`[Message] Holding data missing for ${itemName} @ ${boughtPrice}`, "warn");
                    console.log('[Message] Current holding:', bot.holding);
                    log("[Message] Failed to handle bought auction! Please report this!", "sys");
                    return;
                }

                const estimatedSellPrice = bot.holding[itemName][boughtPrice][0].target;
                log(`[Message] Holding data: ${JSON.stringify(bot.holding[itemName][boughtPrice][0])}`, "debug", true);

                const id = bot.holding[itemName][boughtPrice][0].id;
                const tag = bot.holding[itemName][boughtPrice][0].tag;
                const completeTime = time - bot.holding[itemName][boughtPrice][0].recieveTime;
                const finder = bot.holding[itemName][boughtPrice][0].finder;
                const afterTaxProfit = handleTaxList(boughtPrice, estimatedSellPrice);
                const beforeTaxProfit = estimatedSellPrice - boughtPrice;
                const taxAmount = Math.round(beforeTaxProfit - afterTaxProfit);

                bot.holding[itemName][boughtPrice].shift();

                const profitPercent = ((afterTaxProfit / boughtPrice) * 100).toFixed(2);
                const values = Object.values(bot.holding[boughtPrice] || {});
                const element = values.find(e => e[0]?.[0]?.type !== "Unknown");

                log(`[Message] Element: ${JSON.stringify(element)}`, "debug", true);

                let type = "Unknown";
                let tpmTime;
                if (element) {
                    type = element[0].type;
                    if (type === "Nugget" || type === "Unknown") {
                        tpmTime = element[0].tpmTime;
                    }
                    element.shift();
                }

                const skipped = "False";

                log(`[Message] ${bought[0]}`, "sys", true);

                if (!bot.listPipeline) {
                    bot.listPipeline = [];
                }

                let econString = "";
                econString += `Target: **${BMK(estimatedSellPrice, 1)}**\n`;
                econString += `Profit: **${BMK(afterTaxProfit, 1)} (${profitPercent}%)**\n`;
                econString += `Tax: **${BMK(taxAmount, 1)}**\n`;
                econString += `Finder: **${finder}**`;

                let statString = "";
                statString += `Type: **${type}**\n`;
                statString += `Request Time: **${completeTime}ms**\n`;
                if (type !== "Bed") {
                    statString += `Window to Purchase: **${tpmTime}ms**\n`;
                    statString += `Window Skip: **${skipped}**\n`;
                }

                let accountString = "";
                accountString += `Current Slots: **[${bot.stats.activeSlots}/${bot.stats.totalSlots}]**\n`;
                accountString += `List Time: **${config.customization.listTime} hours**\n`;
                accountString += `Purse: **${BMK(await extractPurse(bot, "claimItem", boughtPrice), 1)}**`;

                bot.listPipeline.push({
                    "item_name": itemName,
                    "sellPrice": estimatedSellPrice,
                    "uuid": id,
                    "finder": finder
                });

                let embed = await bot.hook.embed("Bought Auction!", `# Bought ${itemName} for ${BMK(boughtPrice, 1)} coins! (${BMK(afterTaxProfit)})\n`, "green");
                embed.setURL(`https://sky.coflnet.com/auction/${id}`);
                embed.addFields(
                    { name: "Economics", value: econString, inline: true },
                    { name: "Statistics", value: statString, inline: true },
                    { name: "Additional", value: accountString, inline: false }
                );

                if (bot.listPipeline.length > 0 && (bot.stats.activeSlots === bot.stats.totalSlots || bot.stats.activeSlots + bot.listPipeline.length > bot.stats.totalSlots)) {
                    const queue = bot.stats.activeSlots === bot.stats.totalSlots
                        ? bot.listPipeline.length
                        : bot.stats.activeSlots + bot.listPipeline.length - bot.stats.totalSlots;
                    embed.addFields({
                        name: "Auction House Full",
                        value: `All slots are currently active...\n**This item is ${addOrdinalSuffix(queue)} in queue.**`,
                        inline: false
                    });
                }

                embed.setThumbnail(`https://interceptic.space/item/${tag}`);

                bot.stats.hourlyProfit.push(afterTaxProfit);
                bot.stats.totalProfit += afterTaxProfit;

                setTimeout(async () => {
                    bot.stats.hourlyProfit.shift();
                    await updateStats();
                }, 60 * 60 * 1000);

                await updateStats();
                await bot.hook.send(embed);

                bot.state.emit("addToQueue", "list");
            } catch (boughtError) {
                log(`[Message] Bought handler error: ${boughtError.message}`, "warn");
                console.error('[Message] Bought error:', boughtError);
            }
        }
    } catch (error) {
        log(`[Message] handleMessageEvent error: ${error.message}`, "warn");
        console.error('[Message] handleMessageEvent full error:', error);
    }
}

async function dwarvBot(event, bot) {
    try {
        if ((event.includes("goblin raid") || event.includes("mithril gourmand") || event.includes("raffle")) && event.includes("starts in")) {
            await sleep(500);
            bot.chat("/pchat dwarven mines event in 20 seconds... Warp? (y/n)");
            const response = await listener(bot);
            if (response === 'yes') {
                await warp(bot);
            }
        }
    } catch (error) {
        log(`[Message] dwarvBot error: ${error.message}`, "warn");
    }
}

async function hollowBot(event, bot) {
    try {
        if ((event.includes("powder")) && event.includes("starts in")) {
            await sleep(500);
            bot.chat("/pchat Crystal Hollows 2x powder event in 20 seconds... Warp? (y/n)");
            const response = await listener(bot);
            if (response === 'yes') {
                await warp(bot);
            }
        }
    } catch (error) {
        log(`[Message] hollowBot error: ${error.message}`, "warn");
    }
}

async function listener(bot) {
    return new Promise((resolve) => {
        const onMessage = (message, position) => {
            try {
                if (position === "game_info") return;
                const text = message.toAnsi().toLowerCase();
                if (text.includes('yes') || text.includes('no')) {
                    bot.flayer.off('message', onMessage);
                    clearTimeout(timer);
                    resolve(text.includes('yes') ? 'yes' : 'no');
                }
            } catch (error) {
                log(`[Message] listener onMessage error: ${error.message}`, "warn");
            }
        };

        const timer = setTimeout(() => {
            bot.flayer.off('message', onMessage);
            resolve('no');
        }, 10000);

        bot.flayer.on('message', onMessage);
    });
}

async function warp(bot) {
    try {
        await sleep(700);
        bot.chat("/pchat Warping...");
        await sleep(2500);
        bot.chat("/p warp");
    } catch (error) {
        log(`[Message] warp error: ${error.message}`, "warn");
    }
}

module.exports = { createMessageEvent };
