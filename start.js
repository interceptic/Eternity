const { handler } = require("./components/bot");
const { config } = require("./config.js");
const { askUser } = require("./components/console");
const { log, sleep } = require("./components/utils");
const startTime = Date.now();

process.env.NODE_ENV = process.env.NODE_ENV || "main";
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || "1";

switch (process.env.NODE_ENV) {
    case "main":
        handler(config.username.trim());
        break;
    case "dev":
        require('dotenv').config();
        handler(process.env.username);
        break;
    default:
        console.error(`Unexpected environment: \`${process.env.NODE_ENV}\` -- Should be \`main\` or \`dev\``);
        process.exit(1);
}

askUser(); // handle console

process.on('SIGINT', async () => {
    log('Stopping Process!', "special"); // adds a \n before any ansi
    if (global.bot) {
        const embed = await global.bot.hook.embed("Manually Killed :o", `Stopping ${global.bot.info['name']}!\nBot ran for ${Math.floor((Date.now() - startTime) / 60000)} minutes!`, "red")
        await global.bot.hook.send(embed)
        await sleep(100) // await webhook extra time
    }
    process.exit();
});


