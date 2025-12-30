const { WebhookClient, EmbedBuilder } = require('discord.js');


class OutputHook {
    constructor(webhookURL) {
        this.webhookClient =  new WebhookClient({ url: webhookURL })
        this.recentLog = [];
        this.message = null; 
    }


    async init() {
        const embed = await this.embed("Output", "**Starting...**");
        await this.send(embed);

    }
    async update(line) {
        if(!this.message) {
            return;
        }
        
        if (this.recentLog.length > 20) {
            this.recentLog.shift();
            this.recentLog.push(line)
        } else {
            this.recentLog.push(line)
        }
        

        let baseString = ``
        for(let line of this.recentLog) {
            baseString += line + "\n";
        }
        
        try {
            
            const embed = await this.embed("Output", baseString);
            await this.webhookClient.editMessage(this.message.id, {
                embeds: [embed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error editing output webhook message: ${error}`);
        }
    }

    async send(embed) {
        if (!this.webhookClient) return;
        try {
            this.message = await this.webhookClient.send({
                embeds: [embed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error sending webhook: ${error}`);
        }
    }


    // create embed object which can be edited after creation
    async embed(header, message, color = "#000000" , footer = `Eternity v6.9`) {
        const emb = new EmbedBuilder()
            .setColor(color)
            .setTitle(header)
            .setDescription(message)
            .setFooter({ text: footer, iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&" })
            .setTimestamp()
            // .setThumbnail(`https://mc-heads.net/body/${this.uuid}.png`)
        return emb;
    }
}

module.exports = OutputHook