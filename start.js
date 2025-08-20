const {handler} = require("./components/bot")
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const defaultConfig = require("./defaultConfig.json")
const { askUser } = require("./components/console");
const { log, sleep } = require("./components/utils")

const startTime = Date.now() 

handler(`${config.username}`); // entry point! :DDDDDDDD
askUser() // handle console


process.on('SIGINT', async () => {
    log('Stopping Process!', "special"); // adds a \n before any ansi
    if(global.bot) {
        const embed = await global.bot.hook.embed("Manually Killed :o", `Stopping ${global.bot.info['name']}!\nBot ran for ${Math.floor((Date.now() - startTime) / 60000)} minutes!`, "red")
        await global.bot.hook.send(embed)
        await sleep(100) // await webhook extra time
    }
    process.exit();
  });


