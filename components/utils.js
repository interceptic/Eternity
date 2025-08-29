const fs = require('fs');
const path = require('path');


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


function log(message, struct = "base", hidden = false) {
    // string concatenation basically    
    let base = ''
    const colors = {
        "sys": "\x1b[31m[SYSTEM]\x1b[0m ",
        "warn": "\x1b[93m[WARNING]\x1b[0m ",
        "special": "\n\x1b[31m[SYSTEM]\x1b[0m ", // only used once xD
        "base": ""
    }
    base += colors[struct] + message;
    if (hidden) { // log but dont print to console
        if (typeof message !== 'string') { // shouldnt pass but just in case
            base = base.toString();
        }
        const cleanMessage = base.replace(/\x1b\[[0-9;]*m/g, '');
        fs.appendFileSync(logFile, cleanMessage + '\n');
        return;
    };
    console.log(base);
    return;

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Represents integers such as 123102 as 123.1k or 3134013 as 3.14m

function BMK(num, additionalDecimalPoints = 0 ) {
    let negative = num < 0;
    num = Math.abs(num);
    let thingy;
    if (num >= 1000000000) {
        thingy = (num / 1000000000).toFixed(1 + additionalDecimalPoints) + 'B';
    } else if (num >= 1000000) {
        thingy = (num / 1000000).toFixed(1 + additionalDecimalPoints) + 'M';
    } else if (num >= 1000) {
        thingy = (num / 1000).toFixed(1 + additionalDecimalPoints) + 'K';
    } else {
        thingy = num.toString();
    }
    return `${negative ? '-' : ''}${thingy}`;
}

function styleText(message) {
    // Define color codes
    const colors = {
        '§1': '\x1b[34m', // Dark Blue
        '§2': '\x1b[32m', // Dark Green
        '§3': '\x1b[36m', // Cyan
        '§4': '\x1b[31m', // Dark Red
        '§5': '\x1b[35m', // Magenta
        '§6': '\x1b[33m', // Gold
        '§9': '\x1b[94m', // light blue
        '§8': '', // dark gray
        '§7': '\x1b[36m', // Cyan (Darker Blue)
        '§f': '\x1b[36m', // Cyan (Darker Blue)
        '§k': '\x1b[5m',  // Magic (not supported in all terminals)
        '§l': '\x1b[1m',  // Bold
        '§m': '\x1b[9m',  // Strikethrough
        '§n': '\x1b[4m',  // Underline
        '§o': '\x1b[3m',  // Italic
        '§d': '\x1b[95m', // light magenta
        '§a': '\x1b[92m', // light green
        '§e': '\x1b[93m', // Yellow
        '§r': '\x1b[0m', // Reset
        '§b': '\x1b[94m', // Light Blue
        '§0': '\x1b[30m', // Black
        '§g': '\x1b[32m', // Green
        '§c': '\x1b[33m', // Yellow
        '§p': '\x1b[35m', // Magenta
        '§u': '\x1b[34m', // Blue
        '§i': '\x1b[36m', // Cyan
        '§w': '\x1b[37m', // White
        // stolen or ai generated i forgot where i got these
    };
    for (const [key, value] of Object.entries(colors)) {
        message = message.split(key).join(value);
    }
    return message + colors['§r']; // reset at the end
}

module.exports = { sleep, BMK, log, styleText};