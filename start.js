const { handler } = require("./components/bot");
const { config, configEntry } = require("./config.js");
const { askUser, rl } = require("./components/console");
const { log, sleep, cleanExit } = require("./components/utils");
const startTime = Date.now();
const { version } = require("./package.json");

process.env.NODE_ENV = process.env.NODE_ENV || "main";
process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || "1";


async function main() {
    log(`Attempting start on version: ${version}`, "sys", true);
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
            await cleanExit("Improper Environment")
    }
}

askUser(); // handle console


let closing = false;
// readline for askUser
rl.on('SIGINT', async () => {
    if(closing) return;
    closing = true;
    log('Stopping Process!', "special"); // adds a \n before any ansi
    rl.close();
    await cleanExit("manual");
});

// if readline doesnt exist (shouldnt pass)
process.on('SIGINT', async () => {
    if(closing) return;
    closing = true;
    log('Stopping Process!', "special");
    await cleanExit("manual");
});


main();

