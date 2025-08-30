const fs = require('fs');
const { log } = require("./components/utils")
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

let env = {
    "apiKey": "",
    "webhook": "",
    "username": "",
    "modSocketId": "",
    "customization": {
        "listTime": 0,
        "roundToNearest": 3
    }
}

const mainItems = ["apiKey", "webhook", "username", "modSocketID"];
const customizationItems = ["listTime"];
const warningItems = ["webhook"]

let config = DEFAULT_CONFIG;

if (fs.existsSync('./config.json')) {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} else {
    fs.writeFileSync('./config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
    log("Config.json not found! Please set your username in the config.json file and restart the bot.", "warn");
    process.exit(1);
}

function verifyExists(key) {
    if (!config[key]) {
        console.error(`${key} is not set in config.json! Please set it and restart the bot.`);
        process.exit(1);
    }
}

function verifyExistsCustomization(key) {
    if (!config["customization"][key] == null) {
        console.error(`${key} is not set in config.json! Please set it and restart the bot.`);
        process.exit(1);
    }
    switch (key) {
        case "listTime": {
            if(config["customization"][key] < 1 || config["customization"][key] > 48 || !Number.isInteger(config["customization"][key])) {
                console.error(`'listTime' in customization must be an integer between 1 and 48. Please correct it in config.json then restart the bot.`);
                process.exit(1);
            }
        };
    }
}

function warnExists(key) {
    if (!config[key]) {
        log(`${key} is not set in config.json! If you want to use this feature, please set it.`, "warn");
    }
}

function updateConfig(_config) {
    config = { ..._config, ...config };
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}



// dev below ->

async function createDevConfig() {
    return new Promise(async (resolve, reject) => {
        try {
            Object.assign(config, await seedEnv(mainItems, customizationItems));
        } catch (err) {
            log(`devConfig Error: ${err}`, "warn");
            process.exit(1);
        }
        resolve();
        return;
    })
}

async function seedEnv(mainItems, customizationItems) {
    return new Promise((resolve, reject) => {
        for (const item of mainItems) {
            if (!process.env[item]) {
                if (warningItems.some(warnItem => warnItem === item)) {
                    log(`${item} not set in env! consider adding :)`, "warn");
                    continue;
                }
                log(`${item} does not exist as an environment variable! Please set it in the .env file!`, "warn");
                process.exit(1);
            };
            env[item] = process.env[item];
            continue;
        };
    
        for (const item of customizationItems) {
            if (!process.env[item]) {
                log(`${item} does not exist as an environment variable! Please set it in the .env file!`, "warn");
                process.exit(1);
            };
            env.customization.listTime = parseInt(process.env[item]);
            continue;
        };
        resolve(env);
        return;
    })
}


async function configEntry(dev = false) {
    return new Promise(async (resolve, reject) => {
        if (!dev) {
            verifyExists("username");
            verifyExists("apiKey");
            verifyExistsCustomization("listTime");
            warnExists("webhook");
            resolve();
            return;
        }
        require('dotenv').config(); // loads .env into environment
        await createDevConfig().then(async value => {
            await configEntry();
            resolve();
            return;
        })
    })
}


module.exports = { config, updateConfig, configEntry };
