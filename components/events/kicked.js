const { log } = require('../utils');

/**
 * Parse kick reason from various formats in different MC versions
 * 1.21.11 may send kick reasons in different formats:
 * - Plain string
 * - JSON chat component
 * - Object with text/extra properties
 */
function parseKickReason(reason) {
    try {
        // If already a string, try to parse as JSON
        if (typeof reason === 'string') {
            try {
                const parsed = JSON.parse(reason);
                return extractTextFromComponent(parsed);
            } catch {
                // Not JSON, return as-is
                return reason;
            }
        }

        // If it's an object, extract text
        if (typeof reason === 'object') {
            return extractTextFromComponent(reason);
        }

        return String(reason);
    } catch (error) {
        log(`[Kicked] Error parsing kick reason: ${error.message}`, "warn");
        return String(reason);
    }
}

/**
 * Extract text from a chat component
 */
function extractTextFromComponent(component) {
    try {
        if (!component) return '';

        let text = '';

        // Handle text property
        if (component.text) {
            text += component.text;
        }

        // Handle translate property
        if (component.translate) {
            text += component.translate;
            if (component.with && Array.isArray(component.with)) {
                text += ': ' + component.with.map(w => {
                    if (typeof w === 'string') return w;
                    if (w.text) return w.text;
                    return JSON.stringify(w);
                }).join(', ');
            }
        }

        // Handle extra array
        if (component.extra && Array.isArray(component.extra)) {
            for (const extra of component.extra) {
                if (typeof extra === 'string') {
                    text += extra;
                } else if (extra.text) {
                    text += extra.text;
                } else {
                    text += extractTextFromComponent(extra);
                }
            }
        }

        // Clean up color codes
        text = text.replace(/§[0-9a-fk-or]/gi, '');

        return text || JSON.stringify(component);
    } catch (error) {
        log(`[Kicked] Error extracting text from component: ${error.message}`, "warn");
        return JSON.stringify(component);
    }
}

async function onKick(bot) {
    // Remove prev listeners
    bot.flayer.removeAllListeners('kicked');

    bot.flayer.on('kicked', async (reason, loggedIn) => {
        try {
            log(`[Kicked] Bot kicked, raw reason: ${typeof reason === 'string' ? reason.substring(0, 200) : JSON.stringify(reason).substring(0, 200)}`, "warn");
            log(`[Kicked] Was logged in: ${loggedIn}`, "sys", true);

            const parsedReason = parseKickReason(reason);
            log(`[Kicked] Parsed reason: ${parsedReason}`, "sys");

            const embed = await bot.hook.embed("Bot Kicked", `**Reason:** ${parsedReason}\n**Was logged in:** ${loggedIn}`, "red");
            await bot.hook.send(embed);

        } catch (error) {
            log(`[Kicked] Error handling kick: ${error.message}`, "warn");
            console.error('[Kicked] Full error:', error);

            // Fallback notification
            try {
                const embed = await bot.hook.embed("Bot Kicked", `**Reason:** Unable to parse (see console)\n**Raw:** ${String(reason).substring(0, 100)}...`, "red");
                await bot.hook.send(embed);
            } catch (embedError) {
                log(`[Kicked] Failed to send embed: ${embedError.message}`, "warn");
            }
        }
    });

    log("[Kicked] Kick event listener registered", "sys", true);
}

module.exports = { onKick };
