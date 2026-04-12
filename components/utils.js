const fs = require('fs');
const path = require('path');
const OutputHook = require('./notiHook.js')
const { BMK, styleText } = require('./helpers.js')
const pingRegex = /Your Ping\s*-\s*(\d+)ms/i
const delayRegex = /delayed by ([\d.]+)s on api flips/;

// Where to place log file
const logDir = path.resolve(__dirname, '..', 'log');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const startTime = new Date();
const logFile = path.join(
    logDir,
    `${startTime.toISOString().replace(/:/g, '-')}.log`
);
fs.appendFileSync(logFile, `Process started at ${startTime.toString()}\n`);


// Takes in type of console logging mechanism (console.log, console.error) and appends it to log

['log', 'warn', 'error'].forEach(level => {
    const original = console[level];
    console[level] = (...args) => {
        const message = args
            .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
            .join(' ');
        const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
        fs.appendFileSync(logFile, cleanMessage + '\n');
        original.apply(console, args);
    };
});

let outputHook;

async function initOutputHook(hook, botRef) {
    outputHook = new OutputHook(hook, botRef);
    await outputHook.init();
    return;
}

async function updateStats() {
    await outputHook.updateStats();
    return;
}

async function fetchDelay(bot) {
    return new Promise(async (resolve, reject) => {
        const msg = JSON.stringify({
            type: JSON.stringify("delay"),
            data: JSON.stringify(""),
        })
        let timeout;
        function cleanup() {
            clearTimeout(timeout);
            if(bot.socket) {
                bot.socket.ws.removeListener('message', coflListener)
            }
            resolve();
            return;
        }
        
        const coflListener = async (response) => {
            const msg = JSON.parse(response);
            const data = JSON.parse(msg.data)
            if (msg.type === "writeToChat") {
                let string = data["text"].replace(/§[0-9a-fk-or]/gi, "")
                string = string.match(delayRegex);
                if(string) {
                bot.stats.delay.value = string[1];
                bot.stats.delay.lastUpdate = Date.now();
                bot.lastAction = Date.now();
                await updateStats();
                cleanup()
                }
            }
        }
    
        bot.socket.ws.on('message', coflListener);
        bot.socket.send(msg)
        timeout = setTimeout(async () => {
            
            if(bot.socket) {
                bot.socket.ws.removeListener('message', coflListener)
                bot.stats.delay.value = -1
                bot.stats.delay.lastUpdate = Date.now();
                await updateStats();
            };
            resolve();
            return;
        }, 2000);
    
    })
}

async function fetchPing(bot) {
    return new Promise((resolve, reject) => {
       let timeout;
       
        function cleanup() {
            clearTimeout(timeout);
            bot.flayer.removeListener('message', messageListener);
            resolve();
            return;
        }
        const messageListener = async (message, position) => {
            if (position === "game_info") return;
            
            const ping = message.getText(null).match(pingRegex)

            if(ping) {
                bot.stats.ping.values.push(parseInt(ping[1]))
                bot.stats.ping.lastUpdate = Date.now();
                await updateStats();
                bot.lastAction = Date.now();
                cleanup();
            }

        }    
        bot.flayer.on('message', messageListener);    
        bot.chat("/social pingwars")
        timeout = setTimeout( () => {
            bot.flayer.removeListener('message', messageListener);
            resolve();
            return;
        }, 5000);
    })


}

async function log(message, struct = "base", hidden = false) {
    // string concatenation basically 
    let cleanMessage;   
    let base = ''
    const colors = {
        "sys": "\x1b[31m[SYSTEM]\x1b[0m ",
        "warn": "\x1b[93m[WARNING]\x1b[0m ",
        "special": "\n\x1b[31m[SYSTEM]\x1b[0m ", // only used once xD
        "debug": "\x1b[96m[DEBUG]\x1b[0m ", // Light Cyan for debug messages
        "base": ""
    }
    base += colors[struct] + message;
    if (typeof message !== 'string') { // shouldnt pass but just in case
        base = base.toString();
    }
    cleanMessage = base.replace(/\x1b\[[0-9;]*m/g, '');
    if (hidden) { // log but dont print to console
        fs.appendFileSync(logFile, cleanMessage + '\n');
        return;
    };
    console.log(base);
    if (outputHook) {
        await outputHook.updateOutput(base);
    }
    return;

}



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanExit(reason) {
    if (global.bot) {
        const embed = reason === "manual" ? await global.bot.hook.embed("Manually Stopped Process", `Stopping ${global.bot.info['name']}!\n\n**Bot ran for ${Math.floor((Date.now() - startTime) / 60000)} minutes!**`, "red")
        : await global.bot.hook.embed("System Stopped Process", `Stopping ${global.bot.info['name']} for reason: **${reason}**!\n\n**Bot ran for ${Math.floor((Date.now() - startTime) / 60000)} minutes!**`, "red");
        await global.bot.hook.send(embed);
        await sleep(100); // seems to add an additional bit of grace for the webhook to send
    }
    reason === "manual" ? process.exit(0) : process.exit(1);
}
module.exports = { sleep, BMK, log, styleText, cleanExit, initOutputHook, fetchPing, updateStats, fetchDelay };