const { WebhookClient, EmbedBuilder } = require('discord.js');
const { config } = require('../config.js');
const { version } = require("../package.json");

class Webhook {
    constructor(bot) {
        // Create webhook object and ["string": "colorHex"] dictionary

        this.uuid = bot.info['id']
        this.colors = {
            "red": "#b22222",
            "yellow": "#ffc954",
            "green": "#7cff6e",
            "black": "#000000",
            "white": "#ffffff",
            "blue": "#2f4f7f",
            "lightBlue": "#add8e6",
        }
        const webhook = config.webhook || "";
        this.webhookClient = webhook ? new WebhookClient({ url: webhook }) : null;

    }

    async send(embed) {
        if (!this.webhookClient) return;
        try {
            await this.webhookClient.send({
                embeds: [embed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error sending webhook: ${error}`);
        }
    }


    // create embed object which can be edited after creation
    async embed(header, message, color = "white", footer = `Eternity v${version}`) {
        color = this.colors[color]
        const emb = new EmbedBuilder()
            .setColor(color)
            .setTitle(header)
            .setDescription(message)
            .setFooter({ text: footer, iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&" })
            .setTimestamp()
            .setThumbnail(`https://mc-heads.net/body/${this.uuid}.png`)
        return emb;
    }
}

module.exports = Webhook;