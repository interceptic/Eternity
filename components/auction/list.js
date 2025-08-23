
const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const { log, sleep } = require("../utils")
const { load } = require("./buy")

async function claimItem(bot, auction, type = false) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
            // cleanup();
            reject("Timed out");
            return;
          }, 15000);

      const cleanup = () => {
        clearTimeout(timeout); // if it doesnt hang we dont want this to disable any listeners when listing something else 
      };
  
      const onOpen = async (window) => {
        bot.packets.confirmClick(window.windowId);
        log("Processed claim item window", "sys", true);
        if (JSON.stringify(window.windowTitle).includes("BIN Auction View")) {
          await load(bot.flayer.currentWindow, 31);
          await sleep(350);
          bot.packets.click(31, window.windowId, -1);
          log("Supposedly click on gold nugget/block to claim auction...", "sys", true);
        }
      }; 
  
      const onSlot = async (slot, oldItem, newItem) => {
        // if (oldItem || !newItem) {
        //     log(`oldItem: ${oldItem} | newItem: ${newItem}`, "sys")
        //     return;
        // };
        // if (newItem.displayName !== auction.item) return;
        log(`Slot update at slot ${slot}`, "sys", true)
        auction.slot = slot;
        log("Slot event fired, starting list process...", "sys", true)
        try {
          bot.flayer._client.removeListener('open_window', onOpen)
          await handleList(bot, auction, type).then(() => {
            clearTimeout(timeout)
            log(`Cleared timeout for ${auction.item_name}`, "sys", true)
            resolve();
            return;
          }).catch(err => {
            clearTimeout(timeout)
            reject(err)
            return;
          });
        } catch (e) {
            clearTimeout(timeout)
            reject(e);
        }
      };
  
      bot.flayer._client.once('open_window', onOpen);
      bot.flayer.inventory.once('updateSlot', onSlot);
  
    //   log(`Viewing auction ${auction.id}`, "sys");
      bot.chat(`/viewauction ${auction.uuid}`);
      });
  }
  




    // function slotUpdate(bot, auction) {
    // bot.flayer.inventory.once('updateSlot', async (slot, oldItem, newItem) => {
    //     if (oldItem || !newItem) return // no new item and/or something existed in slot
    //     log(`Claimed ${newItem.displayName} at slot ${slot}`, "sys")
    //     if (newItem.displayName !== auction.item) {
    //         log(`Claimed incorrect item ${newItem.displayName} for ${auction.item}`, "warn")
    //         return;
    //     }
    //     auction.slot = slot;
    //     await handleList(bot, auction)
    // })
//   }
async function handleList(bot, auction, type) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            resolve();
          }, 15000);
      const cleanup = () => {
        clearTimeout(timeout);
        bot.flayer._client.removeListener('open_window', onWindow)};
      let paid = false;
      let time = false;
      const onWindow = async (window) => {
        const title = JSON.stringify(window.windowTitle);
        await sleep (800)
        switch (true) {
          // click the manage auction slot
          case title.includes("Auction House"):
            await load(bot.flayer.currentWindow, 15);
            bot.packets.click(15, window.windowId, -1);
            break;
          case title.includes("Create Auction"):
            await sleep(200);
            bot.packets.click(48, window.windowId, -1);
            break;
          // click the create auction slot
          case title.includes("Manage Auctions"): 
            await sleep(500);
            // handle for when there are active auctions
            const createAuctionSlot = bot.flayer.currentWindow.slots.find((slot) => {
                if (slot) {
                    if (slot.nbt) {
                        if (slot.nbt.value.display.value.Name.value.includes("Create Auction")) return true
                    }
                }
            }).slot
            log(`Found appropriate create auction slot ${createAuctionSlot}`, "sys", true)
            bot.packets.click(createAuctionSlot, window.windowId, -1);
            break;
          // handle main window
          case title.includes("Auction Duration"):
            bot.packets.click(16, window.windowId, -1) // click on sign
            await sleep(500)
            const listTime = (process.env.listTime ?? bot.config.listTime).toString()
            bot.flayer._client.write('update_sign', {
                location: bot.flayer.entity.position.offset(-1, 0, 0),
                text1:  listTime,
                text2: '{"italic":false,"extra":["^^^^^^^^^^^^^^^"],"text":""}',
                text3: '{"italic":false,"extra":["    Auction    "],"text":""}',
                text4: '{"italic":false,"extra":["     hours     "],"text":""}'
            });
            time = true;
            break;
          case title.includes("Create BIN Auction"):
            if (paid && time) {
            await new Promise((resolve, reject) => {
                const checkPriceSlot = () => {
                    const priceSlot = bot.flayer.currentWindow.slots[31]?.nbt?.value?.display?.value?.Name?.value;
                    if (!priceSlot.replace(/,/g, '').includes(`${auction.sellPrice}`)) {
                        log(`Expected list price failed ${priceSlot}`, "sys", true)
                        reject("Price mismatch")
                        return
                    } else {
                        clearInterval(interval);
                        resolve();
                    }
                };
                const interval = setInterval(checkPriceSlot, 250);
                setTimeout(() => clearInterval(interval), 500); // stop checking after 500 ms
            }).catch(err => {
                log(`Failed to list: ${err}`, "warn")
                return;
            })
            setMessageListener(bot, auction, window)
            bot.packets.click(29, window.windowId, -1);
            log("Clicked confirm list...", "sys", true)
            
            
            } else if (paid && !time) {
                await sleep(300);
                bot.packets.click(33, window.windowId, -1) // open clock sign
                log("Clicked slot 33 to open auction duration window", "sys", true)
            } else if (!paid && !time) {
                // bot.flayer._client.once('open_sign_entity', async (sign) => {
                //     log(`Sign entity opened at location: ${JSON.stringify(sign)}`);
                //     log(`location entity opened at location: ${JSON.stringify(sign.location)}`);
                //     let price = auction.sellPrice;
                //     log(`Price to set: ${Math.floor(price)}`);
                //     await sleep(1000);
                //     bot.flayer._client.write('update_sign', {
                //         location: {
                //             "x": sign.location.x,
                //             "y": sign.location.y,
                //             "z": sign.location.z
                //         },
                //         text1: `"${price}"`,
                //         text2: '{"italic":false,"extra":["^^^^^^^^^^^^^^^"],"text":""}',
                //         text3: '{"italic":false,"extra":["    Auction    "],"text":""}',
                //         text4: '{"italic":false,"extra":["     hours     "],"text":""}'
                //     });
                //     log("Sign update event expected");
                // });
                // handleSign(bot, `"${auction.sellPrice}"`)
                
                // put item in slot
                let slot = await load(bot.flayer.currentWindow, 13)
                if (slot !== "stone_button") {
                  bot.packets.click(13, window.windowId, -1);
                  await sleep(300);
                }
                auction.sellPrice = type ? handleRounding(await getNewPrice(bot, auction)
                .catch(err => {
                    reject(err)
                    return
                }) * 0.985)
                : handleRounding(auction.sellPrice) 
                if (isNaN(auction.sellPrice)) {
                    log("Sell price is NaN", "warn");
                    reject("NaN error")
                    return;
                }
                Math.floor(auction.sellPrice) // just incase we have a decimal
                bot.packets.click(auction.slot + bot.flayer.currentWindow.slots.length - 45, window.windowId, -1);
                await sleep(400)

                bot.packets.click(31, window.windowId, -1);
                await sleep(1000)
                bot.flayer._client.write('update_sign', {
                    location: bot.flayer.entity.position.offset(-1, 0, 0),
                    text1: auction.sellPrice.toString(),
                    text2: '{"italic":false,"extra":["^^^^^^^^^^^^^^^"],"text":""}',
                    text3: '{"italic":false,"extra":["    Auction    "],"text":""}',
                    text4: '{"italic":false,"extra":["     hours     "],"text":""}'
                });
                // await sleep(350)
                log(`Price now set to ${auction.sellPrice}`, "sys", true)
                paid = true;
            }
            break;
          case title.includes("Confirm BIN Auction"):
            await sleep(200);
            bot.packets.click(11, window.windowId, -1);

            let embed = await bot.hook.embed("Listed Auction!", `Listed ${auction.item_name} for \`${auction.sellPrice.toLocaleString()}\` coins!`, "lightBlue");
            await bot.hook.send(embed)
            bot.stats.activeSlots++;
            cleanup();
            resolve();
            break;
        }
      };
  
      bot.flayer._client.on('open_window', onWindow);
      bot.chat("/ah");
    });
  }


function handleRounding(price) {
    if (price < 10_000) {
        return price
    } else if (price < 100_000) {
        return Math.floor(price / 10) * 10
    } else if (price < 1_000_000) {
        return Math.floor((price / 100)) * 100
    } else if (price < 10_000_00) {
        return Math.floor((price / 1000)) * 1000
    } else if (price >= 10_000_00) {
        return Math.floor((price / 10000)) * 10000
    } else {
        return NaN; // calculations broke
    }
}


function checkDeviation(data) {
    const median = data[0]?.median;
    const lbin = data[0]?.lbin;

    if (lbin <= 0) {
        return { ignoreList: false, fallBack: true };
    }

    // Higher number = more deviation (might remove in future)
    if (median / lbin >= 4) {
        return {"ignoreList": true, "fallBack": false}
    } else if ((median > 2_500_000 && median < 10_000_000) && median / lbin >= 2) {
        return {"ignoreList": false, "fallBack": true}
    }  else if ((median >= 10_000_000 && median < 25_000_000) && median / lbin >= 1.70) {
        return {"ignoreList": false, "fallBack": true}
    } else if ((median >= 25_000_000 && median < 100_000_000) && median / lbin >= 1.53) {
        return {"ignoreList": false, "fallBack": true}
    } else if ((median >= 100_000_000 && median < 250_000_000) && median / lbin >= 1.40) {
        return {"ignoreList": false, "fallBack": true}
    } else if (median >= 250_000_000 && median / lbin >= 1.30) {
        return {"ignoreList": false, "fallBack": true}
    } else {
        return {"ignoreList": false, "fallBack": false}
    }
}


async function getNewPrice(bot, auction) {
    return new Promise(async (resolve, reject) => {
        try {
            inventoryNbt = {
                "_events": {},
                "_eventsCount": 0,
                "id": 0,
                "type": "minecraft:inventory",
                "title": "Inventory",
                "slots": [bot.flayer.currentWindow.slots[auction.slot + bot.flayer.currentWindow.slots.length - 45]]
            }
            const data = (await axios.post('https://sky.coflnet.com/api/price/nbt', {
                jsonNbt: JSON.stringify(inventoryNbt),
            }, {
                headers: {
                    'accept': 'text/plain',
                    'Content-Type': 'application/json-patch+json',
                },
            })).data

            log(JSON.stringify(data), "sys", true);
            if (data && data.length > 0) {
                const { ignoreList, fallBack } = checkDeviation(data);
                if(ignoreList) {
                    reject(`Ignoring relist of ${auction.item_name} | Deviation mismatch`);
                    return;
                }
                if (fallBack) {
                    auction.sellPrice = data[0].median;
                } else {
                    auction.sellPrice = data[0].lbin;
                }
                resolve(auction.sellPrice);
                return;
            } else {
                reject("No price data received");
                return
            }
        } catch (error) {
            reject(`Unable to reprice: ${error}`);
        }
    });
}


// async function handleSign(bot, price) {
//     return new Promise(async (resolve)   => {
//             log(price)
//             await sleep(400)
//             bot.flayer._client.write('update_sign', {
//                 location: bot.flayer.entity.position.offset(-1, 0, 0),
//                 text1: price,
//                 text2: '{"italic":false,"extra":["^^^^^^^^^^^^^^^"],"text":""}',
//                 text3: '{"italic":false,"extra":["    Auction    "],"text":""}',
//                 text4: '{"italic":false,"extra":["     hours     "],"text":""}'
//             });
//             resolve()
//     })
//}






async function fetchProfile(bot) {
    try {
        const apiKey = process.env.apiKey ?? config.apiKey
        const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${bot.info.id}&key=${apiKey}`);
        const profile = data.profiles.find(profile => profile.selected);
        fs.writeFileSync('./profileData.json', JSON.stringify(profile, null, 2));
        return profile;
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        throw error;
    }
}

async function fetchAuctions(profile_id) {
    const apiKey = process.env.apiKey ?? config.apiKey
    const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/auction?profile=${profile_id}&key=${apiKey}`)
    const auctions = data.auctions.filter(({claimed}) => !claimed)
    const claimableAuctions = auctions.filter(auction => auction.highest_bid_amount > 0 && auction.bin)
    const expiredAuctions = auctions.filter(auction => auction.end < Date.now() && auction.highest_bid_amount === 0 && auction.bin)
    fs.writeFileSync('./auctionData.json', JSON.stringify(data, null, 2));

    return { auctions, claimableAuctions, expiredAuctions };
}
// this is skidded sorry 
async function fetchCoop(profile) {
    const allMembers = Object.keys(profile.members)
    let activeCount = 0;
    for(const coopMember of allMembers) {
        if (!coopMember || coopMember === 0) {
            log(`Skipping undefined uuid`, "warn")
            continue
        }
        const apiKey = process.env.apiKey ?? config.apiKey
        const {data} = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${coopMember}&key=${apiKey}`)
        if (data.profiles) {
            if (data.profiles.find(({profile_id}) => profile_id === profile.profile_id)) {
                activeCount++
            }
        }
    }
    return activeCount;
}
async function findAuctions(bot) {
    profile = await fetchProfile(bot)
    if (bot.stats.totalSlots === null) {
        coopCount = await fetchCoop(profile);
        bot.stats.totalSlots = (14 + ((coopCount - 1) * 3));
    };
    return(await fetchAuctions(profile.profile_id))

}
async function setMessageListener(bot, auction, window) {
    const messageListener = async (message, position) => {
        if (position === "game_info") return;
        if (message.toAnsi().toLowerCase().includes("don't have enough coins")) {
            bot.flayer.closeWindow(window);
            const embed = await bot.hook.embed(`Unable to list ${auction.item}`, `**${auction.item} is too expensive for you to list :(**`, "red");
            await bot.hook.send(embed);
        }
    };
    bot.flayer.on('message', messageListener);
    setTimeout( () => {
        bot.flayer.removeListener('message', messageListener);
    }, 350);

}


module.exports = { findAuctions, claimItem, handleList  }