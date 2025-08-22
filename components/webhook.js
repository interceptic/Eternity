const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));


class Webhook {
    constructor(bot) {
        // Create webhook object and ["string": "colorHex"] dictionary
        
        this.uuid = bot.info['id']
        this.colors = {
            "red": "#ff786e",
            "yellow": "#ffc954",
            "green": "#7cff6e",
            "black": "#000000",
            "white": "#ffffff",
            "blue": "#2f4f7f",
            "lightBlue": "#add8e6",
        }
        if (process.env.webhook) {
            this.webhookClient = new WebhookClient({url: process.env.webhook});
        } else {
            this.webhookClient = new WebhookClient({url: config.webhook});
        }

    }
    
    async send(embed) {
        this.webhookClient.send({
            embeds: [embed],
            username: "Eternity",
            avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
        }).catch(console.error);
    }


    // create embed object which can be edited after creation
    async embed(header, message, color = "white", footer = "Eternity v1.0.0-beta") {
        color = this.colors[color]
        const emb = new EmbedBuilder()
        .setColor(color)
        .setTitle(header) 
        .setDescription(message)
        .setFooter({ text: footer, iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&"}) 
        .setTimestamp()
        .setThumbnail(`https://mc-heads.net/body/${this.uuid}.png`)
        return emb;
    }
}

module.exports = Webhook;