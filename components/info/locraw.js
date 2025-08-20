const { sleep } = require('../utils');

async function getLocraw(bot) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bot.flayer.removeListener('message', messageHandler);
        
        // reject(new Error('getLocraw timeout - no response received'));
        reject("No response (locraw)")
        return
      }, 10000);
      
      // handlers messages
      const messageHandler = (jsonMsg) => {
        try {
          // string conversion
          const msgString = typeof jsonMsg === 'string' ? jsonMsg : jsonMsg.toString()
          
          // json check
          if (msgString.startsWith('{') && msgString.endsWith('}')) {
            const data = JSON.parse(msgString)
            if (data.server || data.gametype || data.map) {
              clearTimeout(timeout); // Clear timeout
              bot.flayer.removeListener('message', messageHandler)
              resolve(data)
            }
          }
        } catch (err) {
          console.error('Error parsing locraw:', err)
        }
      }
  
      // Listen for messages
      bot.flayer.on('message', messageHandler)
      
      
      setTimeout(() => {
        bot.chat('/locraw')
      }, 300)
    })
}


module.exports = { getLocraw }