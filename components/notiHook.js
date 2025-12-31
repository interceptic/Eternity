const { WebhookClient, EmbedBuilder } = require('discord.js');


class OutputHook {
    constructor(webhookURL) {
        this.webhookClient =  new WebhookClient({ url: webhookURL })
        this.recentLog = [];
        this.statsMessage = null;
        this.outputMessage = null; 
    }


    async init(username) {
        const statsEmbed = await this.embed("Stats", `**Account statistics for \`${username}\`**`, 0x00FF00, "Eternity", true);
        const embed = await this.embed("Output", "**Starting...**");
        await this.send(statsEmbed, "stats")
        await this.send(embed, "output");

    }
    async updateOutput(line) {
       
        if(!this.outputMessage) {
            return;
        }
        
        if (this.recentLog.length > 30) {
            this.recentLog.shift();
            this.recentLog.push(line)
        } else {
            this.recentLog.push(line)
        }
        

        let baseString = "```ansi\n";
        for(let line of this.recentLog) {
            baseString += formatOutput(line) + "\n";
        }
        
        try {
            
            const embed = await this.embed("Output", baseString + "```");
            await this.webhookClient.editMessage(this.outputMessage.id, {
                embeds: [embed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error editing output webhook message: ${error}`);
        }
    }

    async send(embed, type) {
        if (!this.webhookClient) return;
        try {
            if(type === "stats") {
                this.statsMessage = await this.webhookClient.send({
                    embeds: [embed],
                    username: "Eternity",
                    avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
                });
                return;
            }
            this.outputMessage = await this.webhookClient.send({
                embeds: [embed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error sending webhook: ${error}`);
        }
    }


    // create embed object which can be edited after creation
    async embed(header, message, color = "#000000" , footer = `Eternity v6.9`, thumbnail = false) {
        const emb = new EmbedBuilder()
            .setColor(color)
            .setTitle(header)
            .setDescription(message)
            .setFooter({ text: footer, iconURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&" })
            .setTimestamp()
        if(thumbnail) {
            emb.setThumbnail(`https://mc-heads.net/head/${global.bot.info.uuid}.png`)
        }
        return emb;
    }
}


function formatOutput(line) {

    const discordAnsiColors = {
        '\x1b[34m': '\u001b[34m', // Dark Blue
        '\x1b[32m': '\u001b[32m', // Dark Green
        '\x1b[36m': '\u001b[36m', // Cyan
        '\x1b[31m': '\u001b[31m', // Dark Red
        '\x1b[35m': '\u001b[35m', // Magenta
        '\x1b[33m': '\u001b[33m', // Gold/Yellow
        '\x1b[94m': '\u001b[94m', // Light Blue
        '': '',                   // Dark Gray (no ANSI escape sequence)
        '\x1b[5m': '\u001b[5m',   // Magic/Blink (not supported in discord)
        '\x1b[1m': '\u001b[1m',   // Bold
        '\x1b[9m': '\u001b[9m',   // Strikethrough
        '\x1b[4m': '\u001b[4m',   // Underline
        '\x1b[3m': '\u001b[3m',   // Italic
        '\x1b[95m': '\u001b[95m', // Light Magenta
        '\x1b[92m': '\u001b[34m', // Light Green
        '\x1b[93m': '\u001b[0m', // Yellow
        '\x1b[0m': '\u001b[0m',   // Reset
        '\x1b[30m': '\u001b[30m', // Black
        '\x1b[37m': '\u001b[37m', // White
        '\x1b[96m': '\u001b[34m'
    };

    for (const [key, value] of Object.entries(discordAnsiColors)) {
        line = line.split(key).join(value);
    }
    return line + discordAnsiColors['\x1b[0m']; // reset at the end
}
module.exports = OutputHook