async function bossBarListener(bot) {
    bot.flayer.on('bossBarUpdated', (bossBar) => {
        console.log(`Boss Bar Title: ${bossBar.title}`);
        console.log(`Boss Bar Health: ${bossBar.health}`);
        console.log(`Boss Bar Color: ${bossBar.color}`);
        console.log(`Boss Bar Division: ${bossBar.division}`);

        // this doesnt work for some reason, i suspect its a mineflayer issue but makes it harder to get fragbot info
      });
}