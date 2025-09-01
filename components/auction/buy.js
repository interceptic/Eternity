const { waitForTicks } = require('../events/tick');
const { log, sleep } = require('../utils')

// store the listener function so it can be removed later
let openWindowListener = null;


function windowStats(bot, windowObj, type, winOpen, latestItem, latestPrice) {
    // e.g, PET_ROCK or SORROW_BOOTS
    const itemTag = windowObj.slots[13].nbt.value.ExtraAttributes.value.id.value 
    // if (itemTag === "PET") {
    //     log(JSON.stringify(windowObj.slots[13].nbt))
    // }
    // string value that contains price and stripping for only number
    const lore = windowObj.slots[31].nbt.value.display.value.Lore.value.value;
    const priceLine = lore.find(line => line.includes("Price:"));
    const noColors = priceLine.replace(/§./g, "");    
    const price = parseInt(noColors.replace(/[^0-9]/g, ""), 10);    
    log(`Price ${price}, Tag ${itemTag}`, "debug", true)
    bot.holding[price][itemTag][0]["type"] = type
    bot.holding[price][itemTag][0]["tpmTime"] = winOpen
    handleMessageEvent(bot, price, itemTag, latestItem, latestPrice)
}

function handleMessageEvent(bot, price, tag, latestItem, latestPrice) {
    let checked = false;
    let purchased = false;
    const messageListener = (message, position) => {
        if (position === "game_info") return;
        const listenerMessage = message.toAnsi()
        if (listenerMessage.includes("Putting coins in escrow...") && !checked) {
            log(`First window time: ${bot.holding[price][tag][0]["tpmTime"]}`, "debug", true)
            if (bot.holding[price][tag][0]["tpmTime"] > 10000)  {// if not already processed 
            bot.holding[price][tag][0]["tpmTime"] = Date.now() - bot.holding[price][tag][0]["tpmTime"]
            }
            checked = true;
        }
        // if purchased comes first just skip
        if(listenerMessage.includes("You purchased")) {
            purchased = true;
            clearTimeout(timeout);
            bot.flayer.removeListener('message', messageListener);
        }
        if(listenerMessage.includes("There was an error") && !purchased) {
            clearTimeout(timeout)
            bot.holding[latestItem][latestPrice].shift() // didnt buy so removes the item (duplicate bug fix)
            bot.holding[price][tag].shift()
            bot.flayer.removeListener('message', messageListener);
        }
    }
    bot.flayer.on('message', messageListener);
    const timeout = setTimeout(() => bot.flayer.removeListener('message', messageListener), 5000);
}

async function buy(bot) {
    // Create the listener function
    openWindowListener = async (window) => {
        try {
            // log('Window event processed, starting buy...', "sys")
            bot.lastAction = Date.now()
            // Timing measurement for window open
            
            bot.packets.confirmClick(window.windowId)
            if (window.windowTitle === '{"italic":false,"extra":[{"text":"BIN Auction View"}],"text":""}') {
                log("Bin Auction View window opened", "sys", true)
                const beforeLoad = Date.now()
                log(`Bin window opened | elapsed: ${beforeLoad - bot.recieveTime}ms`, "debug")      
                let slot = await load(bot.flayer.currentWindow, 31)
                log(`Slot loaded in ${Date.now() - beforeLoad}ms`, "debug", true)                
                log(`found item ${slot} at slot 31`, "sys", true)
                bot.lastWindow = Date.now();
            if (slot === 'gold_nugget') {
                windowStats(bot, bot.flayer.currentWindow, "Nugget", beforeLoad, bot.latestItem, bot.latestPrice)
                bot.packets.click(31, window.windowId, 371)
                bot.betterClick(31, 0, 0)
                // clicking twice for fun
                // bot.hook.send("Opened Window + Clicked on Slot 31", `Opened window!\n${window.windowTitle}\n Slot 31: ${slot}`)

            } else if (slot === 'bed') {
                log("Flip is bed, initiating bed spam...", "sys");
                windowStats(bot, bot.flayer.currentWindow, "Bed", beforeLoad, bot.latestItem, bot.latestPrice)
                await spam(bot, window);

            } else {
                if (slot === 'potato' || slot === 'feather') {log("Missed nugget :(", "sys");};
                bot.holding[bot.latestItem][bot.latestPrice].shift()
                bot.flayer.closeWindow(window)
                bot.state.emit("nextFlip")
            }
            } else if (window.windowTitle === '{"italic":false,"extra":[{"text":"Confirm Purchase"}],"text":""}') {
                // bot.hook.send("Opened Window + Attempting Click on Slot 11", `test...`,)
                log("Opened Confirm Purchase Window", "sys", true)
                let confirmWindow = Date.now()
                log(`Confirm window opened | Since last window: ${confirmWindow - bot.lastWindow} | Elapsed: ${confirmWindow - bot.recieveTime}ms`, "debug")                
                
                let slot = await load(bot.flayer.currentWindow, 11)
                log("Slot 11 loaded!", "sys", true)
                let count = 0;
                while (bot.flayer.currentWindow && count < 2) {
                bot.betterClick(11, 0, 0);
                log(`recognizing click at time ${Date.now() - confirmWindow}ms`, "debug", true)                
                count++;
                }
                
                
                log(`prob clicked, Slot ${slot}`, "sys", true)
                if (slot === 'potato' || slot === 'feather') {log("Missed nugget :( (confirm window)", "sys");}; // shouldnt pass idk why this is here but idk if i want to remove :O
                bot.state.emit("nextFlip");


            } else {
                if (window) {
                    log(`Closing window ${window.windowTitle}`, "debug")
                    bot.flayer.closeWindow(window)
                    bot.state.emit("nextFlip")
                } else {
                    console.error("Attempted to close an undefined window.");
                }
            }
            // send("finsihed code block, check if purchased?", `test...`, null, null, null, type = "attempt")

        } catch (error) {
        console.error(error)
        }
    };
    
    // Register the event listener
    bot.flayer._client.on('open_window', openWindowListener);
}



async function spam(bot, window) {
    try {
        log("Spam function called", "sys", true)
        let lastTick = 0;
        let checkItem;
        bot.flayer.on('physicsTick', async () => {
            if (!bot.flayer.currentWindow || lastTick > 80) {
                bot.flayer.removeAllListeners('physicsTick');
                clearInterval(checkItem)
                log("Bad bed spam sorry this code should be better so tick was canceled", "sys")
                return;
            }
            if (lastTick % 3 === 0 ) {
            bot.packets.click(31, window.windowId, -1);
            bot.betterClick(31, 0, 0);
            }
            lastTick++;
        })
        let item;
        checkItem = setInterval(() => {
            item = bot.flayer.currentWindow?.slots[31]?.name;
            if (item !== 'bed' && item !== undefined && window.windowTitle === bot.flayer.currentWindow.title) {
                bot.flayer.removeAllListeners('physicsTick');
                clearInterval(checkItem);
                log(`Bed changed to ${item}, bed spam cancelled`, "sys")
                bot.flayer.closeWindow(window)
                return;
            }
            if (bot.flayer?.currentWindow?.title === '{"italic":false,"extra":[{"text":"Confirm Purchase"}],"text":""}' || !bot.flayer.currentWindow) { // the 10ms check time could cause ban if really really unlucky? (NOT SURE I DOUBT IT COULD CAUSE BAN BUT JUST BE CAREFUL)
                clearInterval(checkItem);
                bot.flayer.removeAllListeners('physicsTick');
            }
        }, 10);
    } catch (error) {
        console.error("Error during spam:", error);
    }
}




// come back to
async function load(window, slot) {
    return new Promise((resolve) => {
        const timeToLoad = setInterval(() => {
            const itemSlot = window?.slots[slot]; // checks if this is an availabe slot yet (has loaded)
            if (itemSlot) {
                clearInterval(timeToLoad);
                resolve(itemSlot.name);
            }
        }, 1); // check every ms
    });
}

// Functions to enable/disable the open_window listener ->

async function enableOpenWindowListener(bot) {
    if (bot.flayer._client) {
        bot.flayer._client.on('open_window', openWindowListener);
        log('Open window listener enabled', 'sys', true);
    }
}

async function disableOpenWindowListener(bot) {
    if (openWindowListener) {
        bot.flayer._client.removeListener('open_window', openWindowListener);
        log('Open window listener disabled', 'sys', true);
    }
}

module.exports = { buy, load, enableOpenWindowListener, disableOpenWindowListener }