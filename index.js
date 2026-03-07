require("dotenv").config();
const {
    Client,
    Events,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
} = require("discord.js");
const { COMMAND_PREFIX } = require("./config/constants");
const { handlePanelCommands } = require("./handlers/panelCommands");
const { handleGuildMemberAdd } = require("./handlers/welcome");
const { handleReactionRole } = require("./services/panelService");
const { initializeStore } = require("./store/runtimeStore");
const { respond } = require("./utils/discord");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, async () => {
    await initializeStore();
    console.log(`Daora Assistant 로그인됨: ${client.user.tag}`);
});

client.on(Events.GuildMemberAdd, handleGuildMemberAdd);

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
        return;
    }

    const commandLines = message.content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith(COMMAND_PREFIX));

    if (commandLines.length === 0) {
        return;
    }

    if (
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
        await respond(message, "이 명령어는 관리자만 사용할 수 있습니다.");
        return;
    }

    try {
        await handlePanelCommands(message, commandLines);
    } catch (error) {
        console.error("패널 명령 처리 실패:", error);
        await respond(
            message,
            "명령 처리 중 오류가 발생했습니다. 입력 형식과 역할/이모지를 다시 확인해주세요."
        );
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    await handleReactionRole(reaction, user, "add");
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    await handleReactionRole(reaction, user, "remove");
});

client.on(Events.Error, (error) => {
    console.error("Discord client error:", error);
});

client.login(process.env.DISCORD_TOKEN);
