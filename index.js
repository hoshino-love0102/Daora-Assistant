require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("clientReady", () => {
    console.log(`Daora Assistant 로그인됨: ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
    const channel = member.guild.channels.cache.find(
        (ch) => ch.name === "환영합니다"
    );

    if (!channel) return;

    channel.send(`${member} 님, DAORA에 오신 것을 환영합니다!`);
});

client.login(process.env.DISCORD_TOKEN);