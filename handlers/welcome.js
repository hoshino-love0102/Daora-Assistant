const { WELCOME_CHANNEL_NAME } = require("../config/constants");

async function handleGuildMemberAdd(member) {
    const channel = member.guild.channels.cache.find(
        (ch) => ch.name === WELCOME_CHANNEL_NAME
    );

    if (!channel || !channel.isTextBased()) {
        return;
    }

    await channel.send(`${member} 님, DAORA에 오신 것을 환영합니다!`);
}

module.exports = {
    handleGuildMemberAdd,
};
