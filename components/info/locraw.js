const { sleep, log } = require('../utils');

async function getLocraw(bot) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bot.flayer.removeListener('message', messageHandler);
        reject("No response (locraw)")
        return
      }, 10000);
      
      const messageHandler = (jsonMsg) => {
        try {
          const msgString = typeof jsonMsg === 'string' ? jsonMsg : jsonMsg.toString()
          log(`[Locraw] Received message while waiting: "${msgString.substring(0, 100)}"`, "debug", true);
          
          if (msgString.startsWith('{') && msgString.endsWith('}')) {
            const data = JSON.parse(msgString)
            if (data.server || data.gametype || data.map) {
              clearTimeout(timeout);
              bot.flayer.removeListener('message', messageHandler)
              log(`[Locraw] Got response: ${JSON.stringify(data)}`, "debug", true);
              resolve(data)
            }
          }
        } catch (err) {
          log(`[Locraw] Parse error: ${err.message}`, "debug", true);
        }
      }
  
      bot.flayer.on('message', messageHandler)
      
      setTimeout(() => {
        log(`[Locraw] Sending /locraw command`, "debug", true);
        bot.chat('/locraw')
      }, 300)
    })
}


module.exports = { getLocraw }