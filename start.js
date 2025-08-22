const {handler} = require("./components/bot")
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
// const defaultConfig = require("./defaultConfig.json")
const { askUser } = require("./components/console");
const { log, sleep } = require("./components/utils")
const startTime = Date.now() 

switch(process.env.NODE_ENV) {
    case "main": {
        handler(`${config.username}`);
        break;
    }
    case "dev": {
        require('dotenv').config();
        handler(process.env.username)
        break;
    }
    default: {
        console.error(`Unexpected environment: \`${process.env.npm_lifecycle_event}\` -- Should be \`start\` or \`dev\``)
        process.exit(1)
    }
}

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


