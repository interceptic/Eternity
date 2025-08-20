const { createMessageEvent } = require("./message")
const { onSpawn } = require('./spawn')
const { createEnd } = require('./end')
const { physicTick } = require("./tick")
const { onKick } = require("./kicked")

async function createListeners(bot) {
    createMessageEvent(bot);
    onSpawn(bot);
    createEnd(bot);
    physicTick(bot)
    onKick(bot)
}

module.exports = { createListeners };