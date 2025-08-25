const fs = require('fs');

const DEFAULT_CONFIG = {
    "webhook": "",
    "username": "",
    "modSocketID": "",
    "notificationHook": "",
    "apiKey": "",
    "fragbot": {
        "hollows": false,
        "mines": false,
        "partiedUser": ""
    },
    "autoEvents": {
        "kat": false,
        "forge": false,
        "visitors": false
    },
    "customization": {
        "listTime": 24,
        "roundToNearest": 3
    }
}

let config = DEFAULT_CONFIG;

if (fs.existsSync('./config.json')) {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} else {
    fs.writeFileSync('./config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log("Config.json not found! Please set your username in the config.json file and restart the bot.");
    process.exit(1);
}

function verifyExists(key) {
    if (!config[key]) {
        console.error(`${key} is not set in config.json! Please set it and restart the bot.`);
        process.exit(1);
    }
}

function warnExists(key) {
    if (!config[key]) {
        console.warn(`${key} is not set in config.json! If you want to use this feature, please set it.`);
    }
}

function updateConfig(_config) {
    config = { ..._config, ...config };
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

verifyExists("username");
verifyExists("apiKey");
warnExists("webhook");

module.exports = { config, updateConfig };
