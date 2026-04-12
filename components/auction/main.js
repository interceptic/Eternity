const { findAuctions, startRelist } = require('./list');
const { extractPurse } = require('../info/purse');
const { fetchPing, log, sleep } = require('../utils');
const { BMK } = require('../helpers');
const fs = require('fs');
const { handleTaxClaim } = require("./taxes");
const { waitForTicks } = require("../events/tick");
const { listWithoutTarget } = require("./taxes");
const RELIST_LOSS = 0.94;

/**
 * Parse window title from different formats (1.8.9 vs 1.21.11)
 */
function parseWindowTitle(windowTitle) {
    try {
        if (typeof windowTitle === 'string') {
            try {
                const parsed = JSON.parse(windowTitle);
                if (parsed.extra && Array.isArray(parsed.extra)) {
                    return parsed.extra.map(e => e.text || '').join('');
                }
                return parsed.text || windowTitle;
            } catch {
                return windowTitle;
            }
        } else if (typeof windowTitle === 'object') {
            if (windowTitle.extra && Array.isArray(windowTitle.extra)) {
                return windowTitle.extra.map(e => e.text || '').join('');
            }
            if (windowTitle.translate) {
                return windowTitle.translate;
            }
            return windowTitle.text || JSON.stringify(windowTitle);
        }
        return String(windowTitle);
    } catch (error) {
        log(`[Main] Error parsing window title: ${error.message}`, "warn");
        return String(windowTitle);
    }
}

async function mainEntry(bot) {
    try {
        log("[Main] Starting mainEntry", "sys", true);

        const { auctions, claimableAuctions, expiredAuctions } = await findAuctions(bot);
        const purse = await extractPurse(bot);
        await fetchPing(bot);

        const embed = await bot.hook.embed("Ready to Flip!", `# Account Data`,
            "yellow",
            `Eternity | ${BMK(purse, 1)} Coin Purse`
        );

        let totalWorth = 0;

        // Clean up existing list intervals
        if (bot.listIntervals.length > 0) {
            log(`[Main] Clearing ${bot.listIntervals.length} existing list intervals`, "sys", true);
            bot.listIntervals.forEach(intervalId => {
                clearTimeout(intervalId);
            });
            bot.listIntervals = [];
        }

        for (const auction of auctions) {
            totalWorth += auction.starting_bid;
            const currentTime = Date.now();

            if (auction.highest_bid_amount === 0 && auction.bin && auction.end > currentTime) {
                log(`[Main] Will refresh when ${auction.item_name} ends!`, "sys", true);
                const timeout = setTimeout(() => {
                    log(`[Main] Adding relist of ${auction.item_name} to queue!`, "sys");
                    startRelist(bot, auction.uuid);
                }, 30000 + (auction.end - currentTime));
                bot.listIntervals.push(timeout);
            }
        }

        bot.stats.activeSlots = auctions.length;
        log(`[Main] Active slots: ${bot.stats.activeSlots}/${bot.stats.totalSlots}`, "sys", true);

        let claimWorth = 0;
        for (const auction of claimableAuctions) {
            claimWorth += auction.starting_bid;
            bot.claimPipeline.push(auction);
        }

        let expiredWorth = 0;
        let tax = 0;
        for (const auction of expiredAuctions) {
            bot.relistPipeline.push(auction);
            const taxIncluded = listWithoutTarget(auction.starting_bid * RELIST_LOSS);
            const individualItemTax = (auction.starting_bid * RELIST_LOSS) - taxIncluded;
            expiredWorth += taxIncluded;
            tax += individualItemTax;
        }

        embed.addFields(
            {
                name: 'Auction House',
                value: `Current Auctions: **${bot.stats.activeSlots}/${bot.stats.totalSlots} (${BMK(totalWorth)})**\nAuctions to Claim: **${claimableAuctions.length} (${BMK(claimWorth)})**\nAuctions to Relist: **${expiredAuctions.length} | Worth: ~${BMK(expiredWorth)} (${BMK(tax)} Tax)**`,
                inline: false
            }
        );

        await bot.hook.send(embed);

        log(`[Main] Emitting claim and relist queue events`, "sys", true);
        bot.state.emit("addToQueue", "claim");
        bot.state.emit("addToQueue", "relist");

    } catch (error) {
        log(`[Main] mainEntry error: ${error.message}`, "warn");
        console.error('[Main] mainEntry full error:', error);
    }
}

async function claimAuction(bot, auction) {
    try {
        log(`[Main] Starting claimAuction for ${auction.item_name}`, "sys", true);

        const windowHandler = async (window) => {
            try {
                log(`[Main] Claiming ${auction.item_name}`, "sys");
                const wid = window.windowId;
                const title = parseWindowTitle(window.windowTitle);
                log(`[Main] Window opened: "${title}" (id=${wid})`, "sys", true);

                if (title.includes("BIN Auction View")) {
                    if (!bot.claimCell[auction.item_name]) {
                        bot.claimCell[auction.item_name] = {};
                    }
                    const taxedAmount = await handleTaxClaim(auction.highest_bid_amount);
                    bot.claimCell[auction.item_name][taxedAmount] = auction.uuid;

                    // Wait for server to populate window, then click slot 31.
                    // We use raw packet clicks so we don't need parsed slot data.
                    await sleep(600);
                    bot.packets.click(31, wid);

                    await waitForTicks(bot, 3);
                    bot.packets.click(31, wid);

                    log("[Main] Clicked slot 31 during claim", "sys", true);

                    setTimeout(() => {
                        delete bot.claimCell[auction.item_name];
                    }, 3500);

                } else if (title.includes("Confirm Purchase")) {
                    log("[Main] Unexpected Confirm Purchase window during claim", "warn");
                    await sleep(600);
                    bot.packets.click(11, wid);

                } else {
                    log(`[Main] Window not recognized: "${title}"`, "sys");
                    bot.packets.closeWindow(wid);
                }

            } catch (error) {
                log(`[Main] windowHandler error: ${error.message}`, "warn");
            }
        };

        // Remove existing listeners and register new one
        bot.flayer._client.removeAllListeners('open_window');
        bot.flayer._client.once('open_window', windowHandler);

        // Send the command
        bot.chat(`/viewauction ${auction.uuid}`);
        bot.lastAction = Date.now();

    } catch (error) {
        log(`[Main] claimAuction error: ${error.message}`, "warn");
        console.error('[Main] claimAuction full error:', error);
    }
}

module.exports = { mainEntry, claimAuction };
