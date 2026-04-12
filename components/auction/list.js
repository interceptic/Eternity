const axios = require('axios');
const fs = require('fs');
const { config } = require('../../config.js');
const { log, sleep, cleanExit } = require("../utils");
const { BMK, getSlotCustomName } = require("../helpers");
const { extractPurse } = require('../info/purse');

/**
 * Parse window title from different formats (1.8.9 vs 1.21.11).
 * Hypixel often sends NBT-style JSON: { type:"compound", value:{ translate:{ type:"string", value:"..." } } } }
 */
function parseWindowTitle(windowTitle) {
    const unwrap = (node) => {
        if (node == null) return '';
        if (typeof node === 'string') return node;
        if (typeof node !== 'object') return String(node);
        if (node.extra && Array.isArray(node.extra)) {
            return node.extra.map((e) => unwrap(e)).join('');
        }
        if (node.text != null && typeof node.text === 'string') return node.text;
        if (typeof node.translate === 'string') return node.translate;
        if (node.translate != null && typeof node.translate === 'object') {
            return unwrap(node.translate);
        }
        if (node.type === 'string' && node.value != null) return String(node.value);
        if (node.type === 'compound' && node.value != null) return unwrap(node.value);
        if (node.value != null && typeof node.value === 'object') return unwrap(node.value);
        return '';
    };

    try {
        if (typeof windowTitle === 'string') {
            try {
                const parsed = JSON.parse(windowTitle);
                const inner = unwrap(parsed);
                return inner || windowTitle;
            } catch {
                return windowTitle;
            }
        }
        if (typeof windowTitle === 'object') {
            const inner = unwrap(windowTitle);
            return inner || JSON.stringify(windowTitle);
        }
        return String(windowTitle);
    } catch (error) {
        log(`[List] Error parsing window title: ${error.message}`, "warn");
        return String(windowTitle);
    }
}

/** Create Auction button: prefer golden_horse_armor without custom_name; else any golden_horse_armor in the GUI. */
function findCreateAuctionSlotIndex(slots) {
    if (!slots?.length) return null;
    let anyArmor = null;
    for (let si = 0; si < Math.min(slots.length, 54); si++) {
        const s = slots[si];
        if (s?.name !== 'golden_horse_armor') continue;
        if (!s.componentMap?.has('custom_name')) return si;
        anyArmor = si;
    }
    return anyArmor;
}

/** Non-empty slot count + footer row (27–44) + any slot named like horse armor (for logs). */
function manageAuctionsSlotSnapshot(slots) {
    if (!slots?.length) return { text: 'no slots array', nonempty: 0, horseIndices: [] };
    const horseIndices = [];
    let nonempty = 0;
    const footerBits = [];
    for (let i = 0; i < Math.min(slots.length, 54); i++) {
        const s = slots[i];
        if (!s) continue;
        nonempty++;
        const n = s.name || '?';
        if (n === 'golden_horse_armor' || (typeof n === 'string' && n.includes('horse'))) {
            horseIndices.push(i);
        }
        if (i >= 27 && i <= 44 && n !== 'black_stained_glass_pane') {
            const cn = s.componentMap?.has('custom_name') ? 'cn' : 'no-cn';
            footerBits.push(`${i}:${n}(${cn})`);
        }
    }
    const text = `nonempty=${nonempty} len=${slots.length} horses@${JSON.stringify(horseIndices)} footer=[${footerBits.join(' ')}]`;
    return { text, nonempty, horseIndices };
}

function logManageAuctionsFullDump(slots, label) {
    log(`[List] MA ${label} — full non-empty slots (max 54):`, "debug");
    if (!slots?.length) {
        log("[List] MA dump: slots missing or empty array", "debug");
        return;
    }
    for (let i = 0; i < Math.min(slots.length, 54); i++) {
        const s = slots[i];
        if (!s) continue;
        if (s.name === 'black_stained_glass_pane') continue;
        const cn = s.componentMap?.has('custom_name');
        const raw = getSlotCustomName(s);
        const disp = raw && raw !== 'null' ? ` display="${String(raw).slice(0, 40)}"` : '';
        log(`[List] MA dump ${i}: name=${s.name} custom_name_comp=${cn}${disp}`, "debug");
    }
}

/**
 * Poll currentWindow.slots for golden_horse_armor.
 * `openWindowPacket` is the raw open_window payload (for windowId vs currentWindow.id checks).
 */
async function waitForCreateAuctionSlot(bot, openWindowPacket, maxMs = 10000) {
    const packetWid = openWindowPacket?.windowId;
    const t0 = Date.now();
    let lastProgressLog = t0;
    let iterations = 0;
    let warnedIdMismatch = false;

    log(
        `[List] MA find Create Auction: start packetWid=${packetWid} cw.id=${bot.flayer.currentWindow?.id ?? 'null'} cw.slotsLen=${bot.flayer.currentWindow?.slots?.length ?? 'n/a'}`,
        "debug"
    );

    while (Date.now() - t0 < maxMs) {
        iterations++;
        const cw = bot.flayer.currentWindow;
        const slots = cw?.slots;

        if (!warnedIdMismatch && packetWid != null && cw?.id != null && Number(cw.id) !== Number(packetWid)) {
            warnedIdMismatch = true;
            log(
                `[List] MA warn: currentWindow.id (${cw.id}) !== open_window packet windowId (${packetWid}) — scanning may be wrong window`,
                "warn"
            );
        }

        if (slots?.length) {
            const idx = findCreateAuctionSlotIndex(slots);
            if (idx !== null) {
                log(`[List] MA found golden_horse_armor at slot ${idx} after ${Date.now() - t0}ms (${iterations} loops)`, "debug");
                return idx;
            }
        }

        if (Date.now() - lastProgressLog >= 600) {
            lastProgressLog = Date.now();
            if (!slots?.length) {
                log(
                    `[List] MA progress ${Date.now() - t0}ms: no mineflayer window yet (cw=null means window_items likely never parsed)`,
                    "debug"
                );
            } else {
                const snap = manageAuctionsSlotSnapshot(slots);
                log(`[List] MA progress ${Date.now() - t0}ms: ${snap.text}`, "debug");
            }
        }

        // Tight loop when we have a window; slow poll when mineflayer never set currentWindow (saves CPU).
        if (!cw) {
            await sleep(50);
        } else {
            await new Promise((r) => setImmediate(r));
        }
    }

    log(`[List] MA gave up after ${maxMs}ms (${iterations} polls)`, "warn");
    const finalSlots = bot.flayer.currentWindow?.slots;
    const snap = manageAuctionsSlotSnapshot(finalSlots);
    log(`[List] MA final snapshot: ${snap.text}`, "warn");
    logManageAuctionsFullDump(finalSlots, "timeout");
    return null;
}

async function claimItem(bot, auction, type = false) {
    // Safety check to ensure auction object is valid
    if (!auction || !auction.item_name || !auction.uuid) {
        const error = `Invalid auction object: ${JSON.stringify(auction)}`;
        log(`[List] ${error}`, "warn");
        throw new Error(error);
    }

    log(`[List] Starting claimItem for ${auction.item_name} with price ${auction.sellPrice} (type: ${type})`, "sys", true);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            log(`[List] claimItem timeout for ${auction.item_name}`, "warn");
            bot.flayer._client.removeListener('open_window', onOpen);
            bot.flayer.inventory.removeListener('updateSlot', onSlot);
            reject("Timeout Error | claimItem");
            return;
        }, 15000);

        const cleanup = () => {
            clearTimeout(timeout);
        };

        const onOpen = async (window) => {
            try {
                const title = parseWindowTitle(window.windowTitle);
                log(`[List] Processed claim item window: ${title}`, "sys", true);

                if (title.includes("BIN Auction View")) {
                    await sleep(600);
                    bot.packets.click(31, window.windowId);
                    log("[List] Clicked slot 31 to claim auction", "sys", true);
                }
            } catch (error) {
                log(`[List] onOpen error: ${error.message}`, "warn");
            }
        };

        const onSlot = async (slot, oldItem, newItem) => {
            try {
                log(`[List] Slot update at slot ${slot}`, "sys", true);
                auction.slot = slot;
                log("[List] Slot event fired, starting list process...", "sys", true);

                bot.flayer._client.removeListener('open_window', onOpen);
                clearTimeout(timeout);

                await handleList(bot, auction, type).then(() => {
                    log(`[List] Successfully listed ${auction.item_name}`, "sys", true);
                    resolve();
                    return;
                }).catch(err => {
                    log(`[List] handleList error for ${auction.item_name}: ${err}`, "warn");
                    reject(err);
                    return;
                });
            } catch (e) {
                log(`[List] onSlot error: ${e.message}`, "warn");
                clearTimeout(timeout);
                reject(e);
                return;
            }
        };

        bot.flayer._client.once('open_window', onOpen);
        bot.flayer.inventory.once('updateSlot', onSlot);

        log(`[List] Viewing auction ${auction.uuid}`, "sys", true);
        bot.chat(`/viewauction ${auction.uuid}`);
    });
}

async function handleList(bot, auction, type) {
    // Validate auction object at the start
    if (!auction || !auction.item_name || !auction.uuid) {
        const error = `Invalid auction object in handleList: ${JSON.stringify(auction)}`;
        log(`[List] ${error}`, "warn");
        throw new Error(error);
    }

    log(`[List] Starting handleList for ${auction.item_name} with price ${auction.sellPrice} (type: ${type})`, "sys", true);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            log(`[List] handleList timeout for ${auction.item_name}`, "warn");
            cleanup();
            reject("Timeout Error | handleList");
            return;
        }, 20000);

        const cleanup = () => {
            clearTimeout(timeout);
            bot.flayer._client.removeListener('open_window', onWindow);
        };

        let paid = false;
        let time = false;

        const onWindow = async (window) => {
            try {
                const title = parseWindowTitle(window.windowTitle);
                log(`[List] Window opened: "${title}"`, "sys", true);
                await sleep(800);

                switch (true) {
                    case title.includes("Auction House"):
                        log("[List] Auction House window, clicking slot 15", "sys", true);
                        await sleep(600);
                        bot.packets.click(15, window.windowId);
                        break;

                    case title.includes("Create Auction"):
                        log("[List] Create Auction window, clicking slot 48", "sys", true);
                        await sleep(200);
                        bot.packets.click(48, window.windowId);
                        break;

                    case title.includes("Manage Auctions"):
                        log("[List] Manage Auctions window", "sys", true);

                        let createAuctionSlot = await waitForCreateAuctionSlot(bot, window);

                        // If window_items never parses, mineflayer keeps currentWindow=null — cannot scan slots.
                        // Server still accepts window_click with the open_window packet's windowId; Hypixel MA uses slot 33 for Create Auction.
                        if (createAuctionSlot === null && !bot.flayer.currentWindow && window.windowId != null) {
                            createAuctionSlot = 33;
                            log(
                                `[List] MA fallback: blind-click Create Auction slot ${createAuctionSlot} (wid=${window.windowId}) — no mineflayer window`,
                                "warn"
                            );
                        }

                        if (createAuctionSlot !== null) {
                            log(`[List] Clicking Create Auction at slot ${createAuctionSlot}`, "sys", true);
                            bot.packets.click(createAuctionSlot, window.windowId);
                        } else {
                            log(
                                `[List] Could not find Create Auction slot for ${auction.item_name} — see [List] MA dump / progress lines above`,
                                "warn"
                            );
                        }
                        break;

                    case title.includes("Auction Duration"):
                        log("[List] Auction Duration window", "sys", true);
                        await sleep(100);
                        time = true;
                        try {
                            await handleSign(bot, "auctionListTime", window, auction);
                        } catch (error) {
                            log(`[List] HandleSign Time error: ${error}`, "warn");
                            cleanup();
                            reject(`HandleSign Time | ${error}`);
                            return;
                        }
                        break;

                    case title.includes("Create BIN Auction"):
                        log(`[List] Create BIN Auction window (paid: ${paid}, time: ${time})`, "sys", true);

                        if (paid && time) {
                            try {
                                await new Promise((priceResolve, priceReject) => {
                                    const expectedPrice = auction.sellPrice.toString();
                                    const checkPriceSlot = () => {
                                        try {
                                            const slot31 = bot.flayer.currentWindow?.slots?.[31];
                                            if (!slot31) return;
                                            const priceSlot = getSlotCustomName(slot31);
                                            if (!priceSlot) return;
                                            const actualPrice = priceSlot.replace(/,/g, '');
                                            if (!actualPrice) return;

                                            if (actualPrice.includes(expectedPrice)) {
                                                log(`[List] Price validated: ${expectedPrice}`, "debug");
                                                clearInterval(interval);
                                                priceResolve();
                                            }
                                        } catch (error) {
                                            // slot not loaded yet, keep polling
                                        }
                                    };

                                    const interval = setInterval(checkPriceSlot, 250);
                                    setTimeout(() => {
                                        clearInterval(interval);
                                        log(`[List] Price validation timeout, proceeding anyway`, "debug");
                                        priceResolve();
                                    }, 5000);
                                });
                            } catch (err) {
                                log(`[List] Failed to validate price: ${err}`, "warn");
                                cleanup();
                                reject(err);
                                return;
                            }

                            setMessageListener(bot, auction, window);
                            bot.packets.click(29, window.windowId, -1);
                            log("[List] Clicked confirm list (slot 29)", "sys", true);

                        } else if (paid && !time) {
                            await sleep(300);
                            bot.packets.click(33, window.windowId, -1);
                            log("[List] Clicked slot 33 to open duration window", "sys", true);

                        } else if (!paid && !time) {
                            paid = true;
                            await sleep(600);

                            const slotItem = bot.flayer.currentWindow?.slots?.[13];
                            if (!slotItem || slotItem.name !== "stone_button") {
                                bot.packets.click(13, window.windowId);
                                await sleep(300);
                            }

                            if (!auction || !auction.item_name || !auction.uuid) {
                                log(`[List] Auction object corrupted`, "warn");
                                throw new Error(`Auction object corrupted during listing process`);
                            }

                            log(`[List] Processing price for ${auction.item_name}`, "sys", true);

                            let finalPrice;
                            if (type) {
                                log(`[List] Getting new price for relist`, "sys", true);
                                try {
                                    const newPrice = await getNewPrice(bot, auction);
                                    finalPrice = handleRounding(newPrice * 0.985);
                                    log(`[List] Relist price: ${newPrice} -> ${finalPrice}`, "sys", true);
                                } catch (err) {
                                    log(`[List] Failed to get new price: ${err}`, "warn");
                                    cleanup();
                                    reject(err);
                                    return;
                                }
                            } else {
                                log(`[List] Using existing price: ${auction.sellPrice}`, "sys", true);
                                finalPrice = handleRounding(auction.sellPrice);
                            }

                            if (isNaN(finalPrice) || finalPrice <= 0) {
                                log(`[List] Invalid price: ${finalPrice}`, "warn");
                                cleanup();
                                reject("Invalid price error");
                                return;
                            }

                            auction.sellPrice = Math.floor(finalPrice);
                            log(`[List] Final price: ${auction.sellPrice}`, "sys", true);

                            bot.packets.click(auction.slot + bot.flayer.currentWindow.slots.length - 45, window.windowId, -1);
                            await sleep(250);

                            try {
                                await handleSign(bot, "auctionSellPrice", window, auction);
                            } catch (error) {
                                log(`[List] HandleSign Price error: ${error}`, "warn");
                                cleanup();
                                reject(`HandleSign Price | ${error}`);
                                return;
                            }
                            log(`[List] Price set to ${auction.sellPrice}`, "sys", true);
                        }
                        break;

                    case title.includes("Confirm BIN Auction"):
                        log("[List] Confirm BIN Auction window", "sys", true);
                        await sleep(200);
                        bot.packets.click(11, window.windowId, -1);

                        let embed;
                        const purse = await extractPurse(bot);

                        if (type) {
                            let baseString = '';
                            if (auction.data) {
                                baseString += `**[WARNING]**\n Item relisted using median | deviation: ${(auction.sellPrice / auction.data.lbin).toFixed(2)} (LBIN: ${auction.data.lbin})\n`;
                            }
                            baseString += `Listed ${auction.item_name} for \`${auction.sellPrice.toLocaleString()}\` coins!\n\n`;
                            baseString += `Original price: \`${auction.starting_bid?.toLocaleString() || 'unknown'}\``;
                            embed = await bot.hook.embed("Relisted Auction!", baseString, "lightBlue", `Slot [${bot.stats.activeSlots - bot.relistPipeline.length + 1}/${bot.stats.totalSlots}] | ${BMK(purse, 1)} Purse`);
                        } else {
                            bot.stats.activeSlots++;
                            embed = await bot.hook.embed("Listed Auction!", `Listed ${auction.item_name} for \`${auction.sellPrice.toLocaleString()}\` coins!`, "lightBlue", `Slot [${bot.stats.activeSlots}/${bot.stats.totalSlots}] | ${BMK(purse, 1)} Purse`);
                        }

                        embed.setURL(`https://sky.coflnet.com/auction/${auction.uuid}`);
                        embed.setThumbnail(`https://interceptic.space/item/NEW_YEAR_CAKE`);
                        await bot.hook.send(embed);

                        let relistTime = config.customization.listTime;
                        const auctionExpiration = (((relistTime * 60) * 60) * 1000);
                        const relistTimeout = setTimeout(() => {
                            log(`[List] Adding relist of ${auction.item_name} to queue`, "sys");
                            startRelist(bot, auction.uuid);
                        }, 30000 + auctionExpiration);
                        bot.listIntervals.push(relistTimeout);

                        cleanup();
                        resolve();
                        break;

                    default:
                        log(`[List] Unknown window: "${title}"`, "debug");
                        break;
                }
            } catch (error) {
                log(`[List] onWindow error: ${error.message}`, "warn");
                console.error('[List] onWindow full error:', error);
            }
        };

        bot.flayer._client.on('open_window', onWindow);
        bot.chat("/ah");
    });
}

function handleRounding(price) {
    if (price < 10_000) {
        return price;
    } else if (price < 100_000) {
        return Math.floor(price / 10) * 10;
    } else if (price < 1_000_000) {
        return Math.floor(price / 100) * 100;
    } else if (price < 10_000_000) {
        return Math.floor(price / 1000) * 1000;
    } else if (price >= 10_000_000) {
        return Math.floor(price / 10000) * 10000;
    } else {
        return NaN;
    }
}

function checkDeviation(data) {
    const median = data[0]?.median;
    const lbin = data[0]?.lbin;

    if (lbin <= 0) {
        return { ignoreList: false, fallBack: true };
    }

    if (median / lbin >= 4) {
        return { ignoreList: true, fallBack: false };
    } else if ((median > 2_500_000 && median < 10_000_000) && median / lbin >= 2) {
        return { ignoreList: false, fallBack: true };
    } else if ((median >= 10_000_000 && median < 25_000_000) && median / lbin >= 1.70) {
        return { ignoreList: false, fallBack: true };
    } else if ((median >= 25_000_000 && median < 100_000_000) && median / lbin >= 1.53) {
        return { ignoreList: false, fallBack: true };
    } else if ((median >= 100_000_000 && median < 250_000_000) && median / lbin >= 1.40) {
        return { ignoreList: false, fallBack: true };
    } else if (median >= 250_000_000 && median / lbin >= 1.30) {
        return { ignoreList: false, fallBack: true };
    } else {
        return { ignoreList: false, fallBack: false };
    }
}

function rebuildSlotNbt(slot) {
    if (!slot) return null;

    // In 1.21.11, slot.nbt may exist but only contain partial data (e.g. Damage).
    // Always rebuild from components when they're available.
    if (slot.componentMap?.has('custom_data')) {
        const customDataComp = slot.componentMap.get('custom_data').data;
        let extraAttrsInner;
        if (customDataComp?.value && typeof customDataComp.value === 'object') {
            extraAttrsInner = { ...customDataComp.value };
        } else if (customDataComp && typeof customDataComp === 'object') {
            extraAttrsInner = { ...customDataComp };
        } else {
            extraAttrsInner = {};
        }

        const nbtValue = {
            ExtraAttributes: { type: 'compound', value: extraAttrsInner }
        };

        const { extractNbtText } = require('../helpers');
        const nameComp = slot.componentMap.get('custom_name')?.data;
        const loreComp = slot.componentMap.get('lore')?.data;
        if (nameComp || loreComp) {
            const display = {};
            if (nameComp) {
                display.Name = { type: 'string', value: extractNbtText(nameComp) || '' };
            }
            if (loreComp && Array.isArray(loreComp)) {
                display.Lore = {
                    type: 'list',
                    value: { type: 'string', value: loreComp.map(l => extractNbtText(l) || '') }
                };
            }
            nbtValue.display = { type: 'compound', value: display };
        }

        return {
            type: slot.type,
            count: slot.count,
            metadata: slot.metadata || 0,
            nbt: { type: 'compound', name: '', value: nbtValue }
        };
    }

    if (slot.nbt) {
        return { type: slot.type, count: slot.count, metadata: slot.metadata || 0, nbt: slot.nbt };
    }

    return null;
}

async function getNewPrice(bot, auction) {
    return new Promise(async (resolve, reject) => {
        try {
            const rawSlot = bot.flayer.currentWindow.slots[auction.slot + bot.flayer.currentWindow.slots.length - 45];
            const slot = rebuildSlotNbt(rawSlot);

            if (!slot || !slot.nbt?.value || Object.keys(slot.nbt.value).length === 0) {
                log(`[List] rebuildSlotNbt produced empty NBT — raw custom_data: ${JSON.stringify(rawSlot?.componentMap?.get('custom_data')?.data)?.substring(0, 300)}`, "warn");
                reject("Failed to reconstruct item NBT for pricing");
                return;
            }

            const inventoryNbt = {
                "_events": {},
                "_eventsCount": 0,
                "id": 0,
                "type": "minecraft:inventory",
                "title": "Inventory",
                "slots": [slot]
            };

            const payload = JSON.stringify(inventoryNbt);
            log(`[List] Price API payload (truncated): ${payload.substring(0, 500)}`, "debug");

            const { data } = await axios.post('https://sky.coflnet.com/api/price/nbt', {
                jsonNbt: payload,
            }, {
                headers: {
                    'accept': 'text/plain',
                    'Content-Type': 'application/json-patch+json',
                },
            });

            log(`[List] Price API response: ${JSON.stringify(data)}`, "debug");

            if (data && data.length > 0 && data[0]) {
                const entry = data[0];
                if (!entry.lbin && !entry.median) {
                    reject("Price data missing lbin and median");
                    return;
                }

                const { ignoreList, fallBack } = checkDeviation(data);

                if (ignoreList) {
                    reject(`Ignoring relist of ${auction.item_name} | Deviation Mismatch`);
                    return;
                }

                if (fallBack) {
                    log("[List] Switching to median price", "sys");
                    auction.sellPrice = entry.median;
                    auction.data = { "lbin": entry.lbin };
                } else {
                    auction.sellPrice = entry.lbin;
                }

                resolve(auction.sellPrice);
                return;
            } else {
                reject("No price data received");
                return;
            }
        } catch (error) {
            log(`[List] getNewPrice error: ${error.message}`, "warn");
            reject(`Unable to reprice: ${error}`);
        }
    });
}

/**
 * Handle sign editing for 1.21.11
 * In 1.20+, signs have front/back text and the packet structure changed
 */
async function handleSign(bot, value, window, auction) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        const done = (err) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            bot.flayer._client.removeListener('open_sign_editor', signHandler);
            bot.flayer._client.removeListener('packet', packetSpy);
            if (err) reject(err);
            else resolve();
        };

        const timer = setTimeout(() => {
            log(`[List] handleSign timeout waiting for sign editor (${value})`, "warn");
            done(`Sign editor timeout for ${value}`);
        }, 10000);

        let inputText;
        switch (value) {
            case "auctionSellPrice":
                inputText = auction.sellPrice.toString();
                break;
            case "auctionListTime":
                inputText = config.customization.listTime.toString();
                break;
            default:
                done(`Unknown sign value: ${value}`);
                return;
        }

        const signHandler = (packet) => {
            log(`[List] Sign editor opened for ${value}`, "debug");
            const signPos = packet.location || packet.signPosition || {
                x: bot.flayer.entity.position.x - 1,
                y: bot.flayer.entity.position.y,
                z: bot.flayer.entity.position.z
            };

            try {
                bot.flayer._client.write('update_sign', {
                    location: signPos,
                    isFrontText: true,
                    text1: inputText,
                    text2: '',
                    text3: '',
                    text4: ''
                });
                log(`[List] Sent sign update: ${inputText}`, "debug");
            } catch (e) {
                log(`[List] Sign write error: ${e.message}`, "warn");
            }

            setTimeout(() => done(null), 500);
        };

        // Spy on all packets after the click to see what arrives
        const packetSpy = (data, meta) => {
            if (meta.name === 'open_sign_editor' || meta.name === 'open_sign_entity') {
                log(`[List] Got sign packet via spy: ${meta.name}`, "debug");
                bot.flayer._client.removeListener('packet', packetSpy);
                signHandler(data);
            }
        };

        bot.flayer._client.once('open_sign_editor', signHandler);
        bot.flayer._client.on('packet', packetSpy);

        // Click to open the sign
        const clickSlot = value === "auctionSellPrice" ? 31 : 16;
        log(`[List] Clicking slot ${clickSlot} to open ${value} sign (wid=${window.windowId})`, "debug");
        bot.packets.click(clickSlot, window.windowId);
    });
}

async function startRelist(bot, uuid) {
    try {
        log(`[List] Starting relist for ${uuid}`, "sys", true);
        const { auctions, claimableAuctions, expiredAuctions } = await findAuctions(bot);

        for (const expiredAuction of expiredAuctions) {
            if (uuid === expiredAuction.uuid) {
                bot.relistPipeline.push(expiredAuction);
                log(`[List] Added ${expiredAuction.item_name} to relist pipeline`, "sys", true);
                break;
            }
        }

        bot.state.emit("addToQueue", "relist");
    } catch (error) {
        log(`[List] startRelist error: ${error.message}`, "warn");
    }
}

async function apiError(bot, error, type) {
    let reason;

    if (error.response) {
        const status = error.response.status;
        switch (status) {
            case 403:
                reason = `${type}: Invalid API key or key doesn't have required permissions`;
                break;
            case 429:
                reason = `${type}: Rate limit exceeded, please wait before retrying`;
                break;
            case 500:
                reason = `${type}: Internal server error`;
                break;
            case 503:
                reason = `${type}: Service temporarily unavailable`;
                break;
            default:
                reason = `${type}: HTTP ${status} - ${error.response.statusText}`;
        }
    } else if (error.request) {
        reason = `${type}: Network error - no response received`;
    } else {
        log(`${type}: ${error.message} || report this to a developer if this continuously occurs`, "warn");
        reason = `${type}: ${error.message}`;
    }

    log(`[List] API Error: ${reason}`, "warn");
    const embed = await bot.hook.embed("API Error", `**${reason}.**`, "red");
    await bot.hook.send(embed);
    await cleanExit(reason);
}

async function fetchProfile(bot) {
    try {
        log("[List] Fetching profile from Hypixel API", "sys", true);

        const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${bot.info.id}&key=${config.apiKey}`);

        if (data.success === false) {
            log(`[List] Hypixel API Error: ${data.cause || 'Unknown error'}`, "warn");
            throw new Error(`Hypixel API Error: ${data.cause || 'Unknown error'}`);
        }

        const profile = data.profiles.find(profile => profile.selected);
        if (!profile) {
            log("[List] No selected profile found in Hypixel response", "warn");
            throw new Error("No selected profile found");
        }

        fs.writeFileSync('./profileData.json', JSON.stringify(profile, null, 2));
        log("[List] Profile data saved", "sys", true);
        return profile;
    } catch (error) {
        console.error('[List] fetchProfile error:', error);
        await apiError(bot, error, "Unable to fetch player profiles");
    }
}

async function fetchAuctions(profile_id) {
    try {
        log(`[List] Fetching auctions for profile ${profile_id}`, "sys", true);

        const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/auction?profile=${profile_id}&key=${config.apiKey}`);

        if (data.success === false) {
            log(`[List] Hypixel API Error: ${data.cause || 'Unknown error'}`, "warn");
            throw new Error(`Hypixel API Error: ${data.cause || 'Unknown error'}`);
        }

        const auctions = data.auctions.filter(({ claimed }) => !claimed);
        const claimableAuctions = auctions.filter(auction => auction.highest_bid_amount > 0 && auction.bin);
        const expiredAuctions = auctions.filter(auction => auction.end < Date.now() && auction.highest_bid_amount === 0 && auction.bin);

        fs.writeFileSync('./auctionData.json', JSON.stringify(data, null, 2));
        log(`[List] Found ${auctions.length} auctions, ${claimableAuctions.length} claimable, ${expiredAuctions.length} expired`, "sys", true);

        return { auctions, claimableAuctions, expiredAuctions };
    } catch (error) {
        console.error('[List] fetchAuctions error:', error);
        await apiError(bot, error, "Unable to fetch auctions");
    }
}

async function fetchCoop(profile) {
    const allMembers = Object.keys(profile.members);
    let activeCount = 0;

    for (const coopMember of allMembers) {
        if (!coopMember || coopMember === 0) {
            log(`[List] Skipping undefined uuid`, "debug", true);
            continue;
        }

        try {
            const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${coopMember}&key=${config.apiKey}`);

            if (data.success === false) {
                log(`[List] Hypixel API Error for coop member ${coopMember}: ${data.cause || 'Unknown error'}`, "warn");
                continue;
            }

            if (data.profiles) {
                if (data.profiles.find(({ profile_id }) => profile_id === profile.profile_id)) {
                    activeCount++;
                }
            }
        } catch (error) {
            log(`[List] fetchCoop error for ${coopMember}: ${error.message}`, "warn");
            await apiError(bot, error, "Unable to fetch Co-op profiles");
        }
    }

    log(`[List] Found ${activeCount} active coop members`, "sys", true);
    return activeCount;
}

async function findAuctions(bot) {
    const profile = await fetchProfile(bot);

    if (bot.stats.totalSlots === null) {
        const coopCount = await fetchCoop(profile);
        bot.stats.totalSlots = (14 + ((coopCount - 1) * 3));
        log(`[List] Total slots calculated: ${bot.stats.totalSlots}`, "sys", true);
    }

    return await fetchAuctions(profile.profile_id);
}

async function setMessageListener(bot, auction, window) {
    const messageListener = async (message, position) => {
        try {
            if (position === "game_info") return;
            if (message.toAnsi().toLowerCase().includes("don't have enough coins")) {
                log(`[List] Not enough coins to list ${auction.item_name}`, "warn");
                bot.flayer.closeWindow(window);
                const embed = await bot.hook.embed(`Unable to list ${auction.item_name}`, `**${auction.item_name} is too expensive for you to list :(**`, "red");
                await bot.hook.send(embed);
            }
        } catch (error) {
            log(`[List] Message listener error: ${error.message}`, "warn");
        }
    };

    bot.flayer.on('message', messageListener);
    setTimeout(() => {
        bot.flayer.removeListener('message', messageListener);
    }, 350);
}

module.exports = { findAuctions, claimItem, handleList, startRelist };
