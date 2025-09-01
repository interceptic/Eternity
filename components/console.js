const readline = require('readline');
const { log } = require("./utils")
const {restartBot} = require("./events/stall")
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function handleTerminal(command, message) {
    let bot = global.bot;
    switch (command) {
        case 'chat':
            bot.chat(message)
            break;
        case '/stats':
            // soon!
            break;
        case 'state':
            log(`Bot State: ${bot.state.getState()}`, "sys")
            break;
        case ("/cofl"):
            if (!bot || !bot.socket) {
                log("Bot or socket not available", "warn");
                break;
            }
            let words = message.split(" ");
            const arg = JSON.stringify(words[0]);
            words.shift();
            const params = JSON.stringify(words.join(' '));

            const msg = JSON.stringify({
                type: arg,
                data: params
            })
            bot.socket.send(msg)
            break;
        case "restart":
            const embed = await bot.hook.embed("Manual Restart", `Restarting ${bot.info['name']}!`)
            await bot.hook.send(embed)
            await restartBot(bot, "You chose to type \"restart\" in the console!");
            break;
        default: {
            log(`Unknown command: ${command} is not recognized.`, "warn")
        }
    }
}

// The question loop, might need to rework this in the future im p sure i didnt write this
function askUser() {
    rl.question(``, async (input) => {
        const args = input.trim().split(/\s+/);
        let message = args.slice(1).join(' ');
        handleTerminal(args[0], message);
        askUser();
    });
}



module.exports = { askUser, rl }