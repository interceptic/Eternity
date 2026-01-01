const boughtRegex = /^You purchased (.+?) for ([\d,]+) coins!$/; // //thx henry? idk if this was from him
const claimRegex = /You collected ([\d,]+) coins from selling (.+?) to (.+?) in an auction!/;
const fs = require('fs');
const { config } = require('../../config.js');
const { sleep, BMK, log, updateStats } = require("../utils");
const { handleTaxList, handleTaxClaim } = require('../auction/taxes')
const soldRegex = /^\[Auction\] (.+?) bought (.+?) for ([\d,]+) coins CLICK$/; //thx henry :)
const { claimAuction } = require("../auction/main")
const { extractPurse } = require('../info/purse');
const { claimItem } = require('../auction/list.js');
const listRegex = /^(.+?) created (.+?) for (.+?) at ([\d,]+) coins!$/
const listRegex2 = /^(.+?) listed (.+?) for (.+?) at ([\d,]+) coins!$/

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
    bot.flayer.on('message', async (message, position) => {
        if (position === "game_info") return;
        const messageString = typeof message === 'string' ? message : message.toString();
        if (messageString.startsWith('{') && messageString.endsWith('}')) return;
        log(message.toAnsi()); // converts the message to readable color codes and prints to console
        handleMessageEvent(message, bot)
    })
}


async function handleMessageEvent(message, bot) {
    const time = Date.now()
    const event = message.toAnsi().toLowerCase()
       // in future maybe:
        // if (config.fragbot.hollows) {
        //         hollowBot(event, bot);
        //     }
        // else if (config.fragbot.mines) {
        //     dwarvBot(event, bot);
        // }
        
        // base text
        string = message.getText(null)
        
        const claim = string.match(claimRegex)
        // claim[1] is coin amount, [2] is item name, [3] is username
        
        if (claim) {
            log("claimed message recieved", "debug", true);
            log(JSON.stringify(bot.claimCell), "debug", true);
            const price = claim[1];
            const itemName = claim[2];
            const username = claim[3];
            let embed = await bot.hook.embed("Claimed Sold Item!", `Collected \`${price} coins\` for selling \`${itemName}\` to \`${username}\` [(click)](https://sky.coflnet.com/auction/${bot.claimCell[itemName][price.replace(/,/g, '')]})`, "blue")
            bot.stats.activeSlots--;
            await new Promise(resolve => setTimeout(resolve, 1200))
            purse = await extractPurse(bot);
            embed.setFooter({text: `Eternity | ${BMK(purse, 1)} Coin Purse`, iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&"});
            await bot.hook.send(embed);
        }
        

        const soldMatch = string.match(soldRegex);
        if (soldMatch) {
            const item = soldMatch[2];
            const price = soldMatch[3];
            const clickEvent = message?.clickEvent?.value;
            const auctionID = clickEvent.replace('/viewauction ', '').replace(/-/g, '');
           
            const auction = {
                "item_name": item,
                "highest_bid_amount": price.replace(/,/g, ''), // remove commas
                "uuid": auctionID
            }

            if (!bot.claimPipeline) {
                bot.claimPipeline = [];
            }
            bot.claimPipeline.push(auction)
            await bot.state.emit("addToQueue", "claim")
        }


        const bought = string.match(boughtRegex);
        // bought[0] is base string, bought[1] is item, and bought[2] is price
        if (bought) {
            const itemName = bought[1];
            const boughtPrice = bought[2].replace(/,/g, ''); // number without commas (price)
            if (!bot.holding[itemName] || !bot.holding[itemName][boughtPrice] || !bot.holding[itemName][boughtPrice][0]) {
                console.log(bot.holding);
                log("Failed to handle bought auction! Please report this!", "sys");
                return;
            }
            const estimatedSellPrice = bot.holding[itemName][boughtPrice][0].target;
            log(JSON.stringify(bot.holding[itemName][boughtPrice][0]), "debug", true);
            const id = bot.holding[itemName][boughtPrice][0].id;
            const tag = bot.holding[itemName][boughtPrice][0].tag;
            const completeTime = time - bot.holding[itemName][boughtPrice][0].recieveTime;
            const finder =  bot.holding[itemName][boughtPrice][0].finder;
            const afterTaxProfit = handleTaxList(boughtPrice, estimatedSellPrice);
            const beforeTaxProfit = estimatedSellPrice - boughtPrice;
            const taxAmount = Math.round(beforeTaxProfit - afterTaxProfit);
            bot.holding[itemName][boughtPrice].shift(); // remove element 0 to remove flip overlap
            const profitPercent = ((afterTaxProfit / boughtPrice) * 100).toFixed(2);
            const values = Object.values(bot.holding[boughtPrice]);
            const element = values.find(e => e[0][0]?.type !== "Unknown");
            log(JSON.stringify(element), "debug", true);
            let type = "Unknown";
            let tpmTime;
            if (element) {
              type = element[0].type;
              if (type === "Nugget" || type === "Unknown") {
                    tpmTime = element[0].tpmTime
                }
              element.shift(); // removes the first object from this array (dup bug fix)
            }            
            // const type = "Unknown" // force for now
            const skipped = "False"

            
            log(bought[0], "sys", true)
            // [(click)](https://sky.coflnet.com/auction/${id})
            if(!bot.listPipeline) {
                bot.listPipeline = [];
            }
            // let embed = type === "Bed" ? 
            // await bot.hook.embed(`https://sky.coflnet.com/auction/${id}`, `# Bought ${itemName} for ${bought[2]} coins!\n\nProfit: **${BMK(afterTaxProfit)}** | **${profitPercent}%** | **Tax: ${BMK(taxAmount)}**\nFinder: **${finder}** | Type: **${type}**\nSkipped window: **${skipped}**\nElapsed time: **${completeTime}ms**`, "green")
            // : 
            // await bot.hook.embed(`https://sky.coflnet.com/auction/${id}`, `# Bought ${itemName} for ${bought[2]} coins!\n\nProfit: **${BMK(afterTaxProfit)}** | **${profitPercent}%** | **Tax: ${BMK(taxAmount)}**\nFinder: **${finder}** | Type: **${type}**\nSkipped window: **${skipped}**\nElapsed time: **${completeTime}ms** | TPM time: **${tpmTime}ms**`, "green")

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


            // bought[2] is price with commas
            bot.listPipeline.push({"item_name": itemName, "sellPrice": estimatedSellPrice, "uuid": id, "finder": finder});
            let embed = await bot.hook.embed("Bought Auction!", `# Bought ${itemName} for ${BMK(boughtPrice, 1)} coins! (${BMK(afterTaxProfit)})\n`, "green");
            embed.setURL(`https://sky.coflnet.com/auction/${id}`)
            embed.addFields({name: "Economics", value: econString, inline: true}, {name: "Statistics", value: statString, inline: true}, {name: "Additional", value: accountString, inline: false})
            if (bot.listPipeline.length > 0 && (bot.stats.activeSlots === bot.stats.totalSlots || bot.stats.activeSlots + bot.listPipeline.length > bot.stats.totalSlots)) {
                const queue = bot.stats.activeSlots === bot.stats.totalSlots ? bot.listPipeline.length : bot.stats.activeSlots + bot.listPipeline.length - bot.stats.totalSlots
                embed.addFields({name: "Auction House Full", value: `All slots are currently active...\n**This item is ${addOrdinalSuffix(queue)} in queue.**`, inline: false})
            }
            embed.setThumbnail(`https://interceptic.space/item/${tag}`)

            bot.stats.hourlyProfit.push(afterTaxProfit);
            bot.stats.totalProfit += afterTaxProfit;
            setTimeout(async () => {
                bot.stats.hourlyProfit.shift();
                await updateStats();
            }, 60 * 60 * 1000);
            
            await updateStats();
            await bot.hook.send(embed)



            bot.state.emit("addToQueue", "list")
        }   
    }

        // const listMessage = string.match(listRegex)
        // if (listMessage) {
        //     let embed = await bot.hook.embed("Listed Auction", `Listed ${listMessage[3]} for ${listMessage[4]} coins!`, "lightBlue")
        //     await bot.hook.send(embed)
        // }

        // const listMessage2 = string.match(listRegex2)
        // if (listMessage2) {
        //     let embed = await bot.hook.embed("Listed Auction", `Listed ${listMessage2[3]} for ${listMessage2[4]} coins!`, "lightBlue")
        //     await bot.hook.send(embed)
        // }

async function dwarvBot(event, bot) {
    if((event.includes("goblin raid") || event.includes("mithril gourmand") || event.includes("raffle")) && event.includes("starts in")) {
        await sleep(500);
        bot.chat("/pchat dwarven mines event in 20 seconds... Warp? (y/n)")
        response = listener(bot)
        if (response === 'yes') {
            warp(bot)
        }
    }
}

async function hollowBot(event, bot) {
    if ((event.includes("powder")) && event.includes("starts in")) {
        await sleep(500);
        bot.chat("/pchat Crystal Hollows 2x powder event in 20 seconds... Warp? (y/n)")
        response = listener(bot)
        if (response === 'yes') {
            warp(bot)
        }
    }
}


/**
 * Listener function listens for next chat message and will warp if its yes or no
 */

async function listener(bot) {
    const onMessage = (message, position) => {
      if (position === "game_info") return;
      const text = message.toAnsi().toLowerCase();
      if (text.includes('yes') || text.includes('no')) {
        bot.flayer.off('message', onMessage);
        clearTimeout(timer);
        resolve(text.includes('yes') ? 'yes' : 'no');
      }
    };
  
    let resolve;
    const timer = setTimeout(() => {
      bot.flayer.off('message', onMessage);
      resolve('no');
    }, 10000);
  
    const result = await new Promise(res => {
      resolve = res;
      bot.flayer.on('message', onMessage);
    });
  
    return result;
  }
  

async function warp(bot) {
    await sleep(700)
    bot.chat("/pchat Warping...");
    await sleep(2500);
    bot.chat("/p warp")
}

module.exports = { createMessageEvent };