const { claimAuction } = require("./auction/main");
const { sleep, log } = require("./utils");
const EventEmitter = require('events');
const { buy, disableOpenWindowListener } = require("./auction/buy");
const { styleText, BMK } = require("./utils");
const { claimItem } = require("./auction/list")

// I WILL ADD BETTER DOCS FOR THIS SOON 

class DynamicState extends EventEmitter {
    // creates the state for the bot (e.x, spawning, mining, flipping...)
    constructor(bot, state) { 
    super(); // since we inherit from EventEmitter
    this.bot = bot;
    this.bot.listPipeline = []
    this.state = state ?? "waiting"; // inital state
    this.lastAction = `<t:${Math.floor(Date.now() / 1000)}:t>`;
    this.internalState = null;
    this.queue = [];
    this.actionPipeline = [];


    //state management functions
    // add to queue is the entry point for when actions need to be completed
    this.on("addToQueue", async (action, priority = false)  => this.handleQueue(action, priority));
    // waits for internal process to emit the restart function
    this.on("newAction", async (action) => this.handleNewActions(action));
    // act on queue starts the main process function that will start going through the queue
    this.on('actOnQueue', async () => await this.process());
    // restart will recall the process with the updated list
    this.on("restart", async () => this.handleRestart());
    // for information when window is opened
    this.on("windowInformation", async () => this.windowInformation())
  }

  // checks if already handling current queue before modifying list, 
  // if so it will emit a function that will change the internal state to restart actions after current action is complete
  handleQueue(action, priority) {
    if(this.state === "processing") {
        this.emit('newAction', action, priority);
        return;
    }
    if (!this.queue.includes(action) && !this?.actionPipeline.includes(action)) {
        if (priority) {
            this.queue.unshift(action);
        } else {
            this.queue.push(action);
        }
        this.emit("actOnQueue");
    }
  }


  async process() {
    this.state = "processing"; // state flag 
    log(`Starting ${this.queue} action!`, "sys", true)
    for (let i = 0; i < this.queue.length; i++) {
        if (this.internalState === "pipelined") { 
            log("restarting queue process", "sys");
            this.emit("restart");
            return;
        }
        const action = this.queue[i];
        log(`Starting ${action}`, "sys", true)
        switch(action) {
            case "buy": {
                let timeoutId = null;
                let remainingTime = 15000;
                const startTime = Date.now();
                let resolvePromise = null;
                
                const nextFlipHandler = () => {
                    this.bot.flayer.on('message', this.messageListener);
                    if (this.bot.auctionPipeline.length > 0) {
                        const auction = this.bot.auctionPipeline[0]
                        this.bot.waiting = false;
                        this.bot.latestItem = auction.itemName.replace(/§[0-9a-fk-or]/g, '');
                        this.bot.latestPrice = auction.startingBid
                        this.bot.chat(`/viewauction ${auction.id}`);
                        log(styleText(`Starting buy request for ${auction.itemName} at ${BMK(auction.startingBid)} (${BMK(auction.target - auction.startingBid)})`), "sys");
                        log(`Time to send message:  ${Date.now() - auction.recieveTime}ms`, "sys")
                        this.bot.recieveTime = auction.recieveTime;
                        this.bot.auctionPipeline.shift();
                    } else {
                        this.bot.waiting = true; // waiting for next flip if it doesnt have an item in pipeline
                    }
                    setTimeout( () => {
                        this.bot.flayer.removeListener('message', this.messageListener);
                    }, 250);
                    
                    // this timer is ai generated, might be bad
                    // Check if we need to extend the timeout
                    const elapsed = Date.now() - startTime;
                    const timeLeft = remainingTime - elapsed;
                    
                    if (timeLeft < 5000) {
                        // Clear the current timeout
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                        }
                        
                        // Add 5 seconds to remaining time
                        remainingTime += 5000;
                        log(`Extending timeout by 5 seconds. New remaining time: ${timeLeft + 5000}ms`, "sys");
                        
                        // Set new timeout
                        timeoutId = setTimeout(() => {
                            this.removeListener('nextFlip', nextFlipHandler);
                            disableOpenWindowListener(this.bot)
                            log("Buy state finished", "sys")
                            if (resolvePromise) resolvePromise();
                        }, remainingTime - elapsed);
                    }
                };
                
                this.on("nextFlip", nextFlipHandler);
                await buy(this.bot); // could be improved 
                this.emit("nextFlip");
                
                await new Promise(resolve => {
                    resolvePromise = resolve;
                    timeoutId = setTimeout(() => {
                        this.removeListener('nextFlip', nextFlipHandler);
                        disableOpenWindowListener(this.bot)
                        log("Buy state finished", "sys")
                        resolve();
                    }, remainingTime);
                });
                break;
            }
            case "claim": {
                for(let auction of this.bot.claimPipeline) {
                    log(`Attempting to claim ${auction.item_name}`, "sys")
                    await claimAuction(this.bot, auction);
                    await sleep(800);
                }
                this.bot.claimPipeline = []; // might want to make this.bot.claimPipeline = [] if issues in future
                break;
            }
            case "list": {
                for(let s = 0; s < this.bot.listPipeline.length; s++) {
                    if (this.bot.stats.activeSlots === this.bot.stats.totalSlots) {
                        log(`No available slots, ${this.bot.listPipeline[s].item_name} remaining in queue. (${this.bot.listPipeline.length} items in queue)`)
                        break;
                    }
                    if (this.bot.listPipeline[s].finder.toLowerCase().includes("user")) {
                        log(`Not listing ${this.bot.listPipeline[s].item} | Item found by user filter`, "sys")
                        const embed = await this.bot.hook.embed("Failed to List", `Not listing **${this.bot.listPipeline[s].item}** | Found by User Finder`, "white")
                        embed.setURL(`https://sky.coflnet.com/auction/${this.bot.listPipeline[s].uuid}`)
                        await this.bot.hook.send(embed)
                        this.bot.listPipeline.splice(s, 1);
                        s--;
                        continue;
                    }
                    const currentItem = this.bot.listPipeline[s];
                    log(`Attempting to list ${currentItem.item_name} for ${currentItem.sellPrice} (${currentItem.uuid})`, "sys")
                    
                    try {
                        await claimItem(this.bot, currentItem);
                        this.bot.listPipeline.splice(s, 1);
                        s--; // Adjust index since we removed an element
                        log(`Successfully listed ${currentItem.item_name}`, "sys");
                    } catch (err) {
                        log(`List error detected for ${currentItem.item_name}: ${err}`, "warn");
                        log(`Removing ${currentItem.item_name} from pipeline due to permanent error`, "warn");
                        const embed = await this.bot.hook.embed("Failed to List", `Not listing **${currentItem.item_name}** | \`${err}\``, "red")
                        embed.setURL(`https://sky.coflnet.com/auction/${currentItem.uuid}`)
                        await this.bot.hook.send(embed)
                        this.bot.listPipeline.splice(s, 1);
                        s--;     
                    }
                    await sleep(800);
                }
                break;
            }
            case "relist": {
                log("Handling relist", "sys", true)
                for(let s = 0; s < this.bot.relistPipeline.length; s++) {
                    const currentItem = this.bot.relistPipeline[s];
                    try {
                        await claimItem(this.bot, currentItem, "relist");
                        log(`Successfully relisted ${currentItem.item_name}`, "sys");
                    } catch (err) {
                        log(`Relist error detected for ${currentItem.item_name}: ${err}`, "warn");
                        const embed = await this.bot.hook.embed("Failed to Relist", `Not listing **${currentItem.item_name}** | \`${err}\``, "red")
                        embed.setURL(`https://sky.coflnet.com/auction/${currentItem.uuid}`)
                        await this.bot.hook.send(embed)
                    }
                    this.bot.relistPipeline.splice(s, 1);
                    s--;
                    await sleep(700);
                }
            }
        }
        this.queue.splice(i, 1);
        if (this.internalState === "pipelined") {
            log("Internal state is pipelined, restarting queue process!", "sys");
            this.emit("restart");
            return;
        }
        i--;
        
    }
    this.state = "waiting";
  }
  handleNewActions(action, priority) {
    if (!this.actionPipeline) {
        this.actionPipeline = [];
        }
    if (!this.actionPipeline.includes(action)) {
        if (priority) {
            this.actionPipeline.unshift(action); // put at start of array
            } else {
            this.actionPipeline.push(action);
            this.internalState = "pipelined";
            console.log("action pipeline")
            }
        }
    }

  handleRestart() {
    for (let action of this.actionPipeline) {
        this.queue.push(action);
        }
    this.actionPipeline = [];
    this.state = "waiting";
    this.internalState = "waiting"
    this.emit('actOnQueue');
    }


    async windowInformation(type, firstWindow, purchaseMessage) {
        
    }


  getState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
    this.lastAction = `<t:${Math.floor(Date.now() / 1000)}:t>`;
  }

  getInternalState() {
    return this.internalState;
  }

  setInternalState(state) {
    this.internalState = state;
  }

  messageListener = async (message, position) => {
    if (position === "game_info") return;
    if (message.toAnsi().toLowerCase().includes("wasn't found")) {
        this.bot.holding[this.bot.latestItem][this.bot.latestPrice].shift();
        this.emit('nextFlip');
    } else if (message.toAnsi().toLowerCase().includes('cannot view')) {
        log("Unable to view auctions", "warn");
        this.bot.holding[this.bot.latestItem][this.bot.latestPrice].shift();
        this.emit('nextFlip');
    }
    return;
};

}

module.exports = DynamicState