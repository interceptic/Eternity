const { handler } = require("./components/bot");
const { config, configEntry } = require("./config.js");
const { askUser, rl } = require("./components/console");
const { log, sleep } = require("./components/utils");
const startTime = Date.now();

process.env.NODE_ENV = process.env.NODE_ENV || "main";
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || "1";


async function main() {
    switch (process.env.NODE_ENV) {
        case "main":
            await configEntry();
            handler(config.username.trim());
            break;
        case "dev":
            await configEntry(true)
            handler(process.env.username);
            break;
        default:
            console.error(`Unexpected environment: \`${process.env.NODE_ENV}\` -- Should be \`main\` or \`dev\``);
            process.exit(1);
    }
}

askUser(); // handle console

// readline for askUser
rl.on('SIGINT', async () => {
    log('Stopping Process!', "special"); // adds a \n before any ansi
    rl.close();
    await handleClose();
});

// if readline doesnt exist (shouldnt pass)
process.on('SIGINT', async () => {
    log('Stopping Process!', "special");
    await handleClose();
});

async function handleClose() {
    if (global.bot) {
        const embed = await global.bot.hook.embed("Manually Killed :o", `Stopping ${global.bot.info['name']}!\nBot ran for ${Math.floor((Date.now() - startTime) / 60000)} minutes!`, "red");
        await global.bot.hook.send(embed);
        await sleep(100); // seems to add an additional bit of grace for the webhook to send
    }
    process.exit();
}


main();

