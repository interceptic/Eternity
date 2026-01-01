const { WebhookClient, EmbedBuilder } = require('discord.js');

class OutputHook {
    constructor(webhookURL, botRef) {
        this.webhookClient =  new WebhookClient({ url: webhookURL })
        this.recentLog = [];
        this.statsMessage = null;
        this.outputMessage = null; 
        this.bot = botRef;
    }


    async init() {
        const startUnix = calcUnix(this.bot.stats.startTime);
        const pingUnix = calcUnix(this.bot.stats.ping.lastUpdate);
        const delayUnix = calcUnix(this.bot.stats.delay.lastUpdate);
        const ProfitPerHour = BMK(this.bot.stats.hourlyProfit.reduce((acc, value) => acc + value, 0));
        const averagePing = this.bot.stats.ping.values.reduce((acc, value) => acc + value, 0);
        const statsEmbed = await this.embed(`\`${this.bot.info['name']}\` Runtime Statistics`, `***Started <t:${startUnix}:R>***\n\n**Profit/h:** ${ProfitPerHour}  | **Total:** ${BMK(this.bot.stats.totalProfit)}\n\n**Average Ping:** ~${averagePing}ms (${this.bot.stats.ping.values.length}) | (Last Update: <t:${pingUnix}:R>)\n\n **Delay:**  ${Math.floor(this.bot.stats.delay.value * 1000)}ms (Last Update: <t:${delayUnix}:R>)
`, 0xe7ffeb, "Eternity", true);
        
        statsEmbed.setAuthor({
            name: `discord.gg/skyternity`,
            iconURL: `https://cdn.discordapp.com/attachments/1455682430710186155/1456033797316546797/1818px-Discord_Logo_sans_texte.png?ex=6956e4a5&is=69559325&hm=40c0e358eb3f5d49a3ed4c4e04edec87be2afa3cfdd451ac52ee64c075421f5e&`,
            url: "https://discord.com/invite/skyternity"
        });
        // const unix = Math.floor(this.bot.lastRecordedDelay['time'] / 1000);
        const embed = await this.embed("Output", "```ansi\n```");
        await this.send(statsEmbed, "stats")
        await this.send(embed, "output");

    }

    async updateStats() {
        if(!this.statsMessage) {
            return;
        }
        
        try {
            const startUnix = calcUnix(this.bot.stats.startTime);
            const pingUnix = calcUnix(this.bot.stats.ping.lastUpdate);
            const delayUnix = calcUnix(this.bot.stats.delay.lastUpdate);
            let delay;
            if (this.bot.stats.delay.value < 0) { // IF N/A
                delay = "N/A"
            } else {
                delay = Math.floor(this.bot.stats.delay.value * 1000)
            }
            const ProfitPerHour = BMK(this.bot.stats.hourlyProfit.reduce((acc, value) => acc + value, 0));
            const averagePing = this.bot.stats.ping.values.reduce((acc, value) => acc + value, 0);
            const statsEmbed = await this.embed(`\`${this.bot.info['name']}\` Runtime Statistics`, `***Started <t:${startUnix}:R>***\n\n**Profit/h:** ${ProfitPerHour}  | **Total:** ${BMK(this.bot.stats.totalProfit)}\n\n**Average Ping:** ~${averagePing}ms (${this.bot.stats.ping.values.length}) | (Last Update: <t:${pingUnix}:R>)\n\n **Delay:**  ${delay}ms (Last Update: <t:${delayUnix}:R>)`, 0xe7ffeb, "Eternity", true);
            
            statsEmbed.setAuthor({
                name: `discord.gg/skyternity`,
                iconURL: `https://cdn.discordapp.com/attachments/1455682430710186155/1456033797316546797/1818px-Discord_Logo_sans_texte.png?ex=6956e4a5&is=69559325&hm=40c0e358eb3f5d49a3ed4c4e04edec87be2afa3cfdd451ac52ee64c075421f5e&`,
                url: "https://discord.com/invite/skyternity"
            });
            
            await this.webhookClient.editMessage(this.statsMessage.id, {
                embeds: [statsEmbed],
                username: "Eternity",
                avatarURL: "https://cdn.discordapp.com/attachments/1340811695769124914/1341163186715623474/image_1.png?ex=67b4ff0d&is=67b3ad8d&hm=26a2179b1f7709cf56aa0dfe713ea8049bc2c91857d9e03b343dab44f52ad693&",
            });
        } catch (error) {
            console.error(`Error editing output webhook message: ${error}`);
        }
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
            emb.setThumbnail(`https://mc-heads.net/head/${this.bot.info['id']}.png`)
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

function BMK(num, additionalDecimalPoints = 0 ) {
    let negative = num < 0;
    num = Math.abs(num);
    let thingy;
    if (num >= 1000000000) {
        thingy = (num / 1000000000).toFixed(1 + additionalDecimalPoints) + 'B';
    } else if (num >= 1000000) {
        thingy = (num / 1000000).toFixed(1 + additionalDecimalPoints) + 'M';
    } else if (num >= 1000) {
        thingy = (num / 1000).toFixed(1 + additionalDecimalPoints) + 'K';
    } else {
        thingy = num.toString();
    }
    return `${negative ? '-' : ''}${thingy}`;
}

function calcUnix(time) {
    return Math.floor(time / 1000);
}
module.exports = OutputHook