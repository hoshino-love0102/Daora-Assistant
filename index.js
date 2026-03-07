require("dotenv").config();
const {
    ChannelType,
    Client,
    Events,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
} = require("discord.js");
const { loadStore, saveStore } = require("./panelStore");

const WELCOME_CHANNEL_NAME = "환영합니다";
const COMMAND_PREFIX = "!패널";

let store = {
    panels: {},
    publishedMessages: {},
};

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
    store = await loadStore();
    console.log(`Daora Assistant 로그인됨: ${client.user.tag}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
    const channel = member.guild.channels.cache.find(
        (ch) => ch.name === WELCOME_CHANNEL_NAME
    );

    if (!channel || !channel.isTextBased()) {
        return;
    }

    await channel.send(`${member} 님, DAORA에 오신 것을 환영합니다!`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
        return;
    }

    if (!message.content.includes(COMMAND_PREFIX)) {
        return;
    }

    if (
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
        await respond(message, "이 명령어는 관리자만 사용할 수 있습니다.");
        return;
    }

    try {
        await handlePanelCommands(message);
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

async function handlePanelCommands(message) {
    const lines = message.content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith(COMMAND_PREFIX));

    for (const line of lines) {
        await handlePanelCommand(message, line);
    }
}

async function handlePanelCommand(message, rawCommand) {
    const body = rawCommand.slice(COMMAND_PREFIX.length).trim();

    if (!body || body === "도움말") {
        await respond(message, getHelpMessage());
        return;
    }

    const [action, ...restParts] = body.split(" ");
    const rest = restParts.join(" ").trim();

    switch (action) {
        case "생성":
            await createPanel(message, rest);
            return;
        case "설명":
            await updatePanelDescription(message, rest);
            return;
        case "추가":
            await addPanelItem(message, rest);
            return;
        case "제거":
            await removePanelItem(message, rest);
            return;
        case "보기":
            await previewPanel(message, rest);
            return;
        case "목록":
            await listPanels(message);
            return;
        case "발행":
            await publishPanel(message, rest);
            return;
        case "삭제":
            await deletePanel(message, rest);
            return;
        default:
            await respond(message, getHelpMessage());
    }
}

async function createPanel(message, panelName) {
    if (!panelName) {
        await respond(message, "사용법: `!패널 생성 패널이름`");
        return;
    }

    const guildPanels = getGuildPanels(message.guild.id);
    if (guildPanels[panelName]) {
        await respond(message, "같은 이름의 패널이 이미 존재합니다.");
        return;
    }

    guildPanels[panelName] = {
        name: panelName,
        description: "원하는 이모지를 클릭하면 역할이 부여됩니다.",
        items: [],
    };
    await persistStore();
    await respond(
        message,
        `패널 \`${panelName}\` 을(를) 만들었습니다.\n다음으로 \`!패널 추가 ${panelName} | @역할 | 이모지\` 형식으로 항목을 넣어주세요.`
    );
}

async function updatePanelDescription(message, rest) {
    const [panelName, description] = splitByPipe(rest, 2);
    if (!panelName || !description) {
        await respond(message, "사용법: `!패널 설명 패널이름 | 설명`");
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    panel.description = description;
    await persistStore();
    await respond(message, `패널 \`${panelName}\` 설명을 수정했습니다.`);
}

async function addPanelItem(message, rest) {
    const [panelName, roleInput, emojiInput] = splitByPipe(rest, 3);
    if (!panelName || !roleInput || !emojiInput) {
        await respond(
            message,
            "사용법: `!패널 추가 패널이름 | @역할 또는 역할명 | 이모지`"
        );
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    const { role, created } = await resolveOrCreateRole(message, roleInput);

    const emoji = resolveEmoji(message.guild, emojiInput);
    if (!emoji) {
        await respond(
            message,
            "이모지를 찾지 못했습니다. 유니코드 이모지 또는 현재 서버 커스텀 이모지를 사용해주세요."
        );
        return;
    }

    const existingIndex = panel.items.findIndex((item) => item.roleId === role.id);
    const newItem = {
        roleId: role.id,
        roleName: role.name,
        emoji,
    };

    if (existingIndex >= 0) {
        panel.items[existingIndex] = newItem;
    } else {
        panel.items.push(newItem);
    }

    await persistStore();
    await respond(
        message,
        [
            created ? `역할 \`${role.name}\` 을(를) 새로 생성했습니다.` : null,
            `패널 \`${panelName}\`에 \`${role.name}\` 역할과 ${formatEmojiLabel(
                emoji
            )} 이모지를 연결했습니다.`,
        ]
            .filter(Boolean)
            .join("\n")
    );
}

async function removePanelItem(message, rest) {
    const [panelName, roleInput] = splitByPipe(rest, 2);
    if (!panelName || !roleInput) {
        await respond(message, "사용법: `!패널 제거 패널이름 | @역할 또는 역할명`");
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    const role = resolveRole(message, roleInput);
    const nextItems = panel.items.filter(
        (item) => item.roleId !== role?.id && item.roleName !== roleInput
    );

    if (nextItems.length === panel.items.length) {
        await respond(message, "해당 역할은 이 패널에 등록되어 있지 않습니다.");
        return;
    }

    panel.items = nextItems;
    await persistStore();
    await respond(message, `패널 \`${panelName}\`에서 역할 항목을 제거했습니다.`);
}

async function previewPanel(message, panelName) {
    if (!panelName) {
        await respond(message, "사용법: `!패널 보기 패널이름`");
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    await respond(message, renderPanel(panel, message.guild));
}

async function listPanels(message) {
    const guildPanels = getGuildPanels(message.guild.id);
    const names = Object.keys(guildPanels);

    if (names.length === 0) {
        await respond(
            message,
            "아직 생성된 패널이 없습니다.\n`!패널 생성 패널이름` 으로 시작하세요."
        );
        return;
    }

    await respond(
        message,
        ["현재 패널 목록:", ...names.map((name) => `- ${name}`)].join("\n")
    );
}

async function publishPanel(message, rest) {
    const [panelName, channelInput] = splitByPipe(rest, 2);
    if (!panelName) {
        await respond(
            message,
            "사용법: `!패널 발행 패널이름` 또는 `!패널 발행 패널이름 | #채널`"
        );
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    if (panel.items.length === 0) {
        await respond(message, "패널 항목이 없습니다. 먼저 `!패널 추가`로 역할을 등록해주세요.");
        return;
    }

    const targetChannel =
        resolveChannel(message, channelInput) || message.channel;

    if (!targetChannel.isTextBased()) {
        await respond(message, "발행 대상은 텍스트 채널이어야 합니다.");
        return;
    }

    const roleMessage = await targetChannel.send({
        content: renderPanel(panel, message.guild),
    });

    for (const item of panel.items) {
        await roleMessage.react(getReactionIdentifier(item.emoji));
    }

    store.publishedMessages[roleMessage.id] = {
        guildId: message.guild.id,
        channelId: targetChannel.id,
        panelName: panel.name,
    };
    await persistStore();

    await respond(
        message,
        `패널 \`${panel.name}\` 을(를) ${targetChannel} 채널에 발행했습니다.`
    );
}

async function deletePanel(message, panelName) {
    if (!panelName) {
        await respond(message, "사용법: `!패널 삭제 패널이름`");
        return;
    }

    const guildPanels = getGuildPanels(message.guild.id);
    if (!guildPanels[panelName]) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    delete guildPanels[panelName];
    await persistStore();
    await respond(message, `패널 \`${panelName}\` 을(를) 삭제했습니다.`);
}

async function handleReactionRole(reaction, user, action) {
    if (user.bot) {
        return;
    }

    try {
        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        const { message } = fullReaction;
        const published = store.publishedMessages[message.id];

        if (!published || published.guildId !== message.guild?.id) {
            return;
        }

        const panel = getPanel(published.guildId, published.panelName);
        if (!panel) {
            return;
        }

        const matchedItem = panel.items.find((item) =>
            matchesEmoji(item.emoji, fullReaction.emoji)
        );
        if (!matchedItem) {
            return;
        }

        const member = await message.guild.members.fetch(user.id);
        const role = await message.guild.roles.fetch(matchedItem.roleId);
        if (!role) {
            return;
        }

        if (action === "add" && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }

        if (action === "remove" && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
        }
    } catch (error) {
        console.error("역할 반응 처리 실패:", error);
    }
}

function getGuildPanels(guildId) {
    if (!store.panels[guildId]) {
        store.panels[guildId] = {};
    }

    return store.panels[guildId];
}

function getPanel(guildId, panelName) {
    return getGuildPanels(guildId)[panelName];
}

function resolveRole(message, input) {
    const trimmed = input.trim();
    const mentionedRole = message.mentions.roles.first();
    if (mentionedRole) {
        return mentionedRole;
    }

    const normalized = normalizeRoleInput(trimmed);

    return (
        message.guild.roles.cache.find((role) => role.name === trimmed) ||
        message.guild.roles.cache.find((role) => role.name === normalized) ||
        message.guild.roles.cache.find((role) =>
            role.name.replace(/\s+/g, "") === normalized.replace(/\s+/g, "")
        ) ||
        message.guild.roles.cache.find(
            (role) => role.name.toLowerCase() === normalized.toLowerCase()
        )
    );
}

async function resolveOrCreateRole(message, input) {
    const existingRole = resolveRole(message, input);
    if (existingRole) {
        return { role: existingRole, created: false };
    }

    const roleName = normalizeRoleInput(input);
    if (!roleName) {
        throw new Error("역할 이름이 비어 있습니다.");
    }

    const createdRole = await message.guild.roles.create({
        name: roleName,
        reason: "Daora Assistant 패널 역할 자동 생성",
    });

    return { role: createdRole, created: true };
}

function resolveChannel(message, input) {
    if (!input) {
        return null;
    }

    const mentionedChannel = message.mentions.channels.first();
    if (mentionedChannel) {
        return mentionedChannel;
    }

    return message.guild.channels.cache.find(
        (channel) =>
            channel.type === ChannelType.GuildText && channel.name === input.trim()
    );
}

function resolveEmoji(guild, input) {
    const trimmed = input.trim();
    const customEmojiMatch = trimmed.match(/^<a?:(\w+):(\d+)>$/);
    if (customEmojiMatch) {
        const emoji = guild.emojis.cache.get(customEmojiMatch[2]);
        return emoji ? guildEmojiToStorage(emoji) : null;
    }

    const namedEmoji = guild.emojis.cache.find(
        (emoji) => emoji.name === trimmed.replaceAll(":", "")
    );
    if (namedEmoji) {
        return guildEmojiToStorage(namedEmoji);
    }

    if (isUnicodeEmoji(trimmed)) {
        return trimmed;
    }

    return null;
}

function guildEmojiToStorage(emoji) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

function isUnicodeEmoji(value) {
    return /\p{Extended_Pictographic}/u.test(value);
}

function renderPanel(panel, guild) {
    return [
        `<${panel.name}>`,
        panel.description,
        "",
        ...panel.items.map((item) => {
            const roleName = guild.roles.cache.get(item.roleId)?.name || item.roleName;
            return `${roleName} (${formatEmojiLabel(item.emoji)})`;
        }),
    ].join("\n");
}

function splitByPipe(input, expectedParts) {
    if (!input) {
        return [];
    }

    const parts = input.split("|").map((part) => part.trim());
    if (parts.length < expectedParts) {
        return parts;
    }

    const head = parts.slice(0, expectedParts - 1);
    const tail = parts.slice(expectedParts - 1).join(" | ").trim();
    return [...head, tail];
}

function getReactionIdentifier(emoji) {
    const customEmojiMatch = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (!customEmojiMatch) {
        return emoji;
    }

    return customEmojiMatch[2];
}

function formatEmojiLabel(emoji) {
    const customEmojiMatch = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (!customEmojiMatch) {
        return emoji;
    }

    return `<:${customEmojiMatch[1]}:${customEmojiMatch[2]}>`;
}

function matchesEmoji(configuredEmoji, reactionEmoji) {
    const customEmojiMatch = configuredEmoji.match(/^<a?:(\w+):(\d+)>$/);
    if (!customEmojiMatch) {
        return configuredEmoji === reactionEmoji.name;
    }

    return reactionEmoji.id === customEmojiMatch[2];
}

function getHelpMessage() {
    return [
        "패널 명령어:",
        "- `!패널 생성 패널이름`",
        "- `!패널 설명 패널이름 | 설명`",
        "- `!패널 추가 패널이름 | @역할 또는 역할명 | 이모지`",
        "- `!패널 제거 패널이름 | @역할 또는 역할명`",
        "- `!패널 보기 패널이름`",
        "- `!패널 목록`",
        "- `!패널 발행 패널이름 | #채널`",
        "- `!패널 삭제 패널이름`",
        "",
        "예시:",
        "- `!패널 생성 언어역할`",
        "- `!패널 설명 언어역할 | 여러분이 주로 사용하는 언어를 골라주세요!`",
        "- `!패널 추가 언어역할 | @Python | <:python:123456789012345678>`",
        "- `!패널 발행 언어역할 | #역할받기`",
    ].join("\n");
}

async function respond(message, content) {
    return message.channel.send(content);
}

function normalizeRoleInput(value) {
    return value.replace(/^@+/, "").trim();
}

function buildRoleNotFoundMessage(message, roleInput) {
    const normalized = normalizeRoleInput(roleInput);
    const similarRoles = message.guild.roles.cache
        .filter((role) =>
            role.name.toLowerCase().includes(normalized.toLowerCase())
        )
        .map((role) => role.name)
        .slice(0, 5);

    if (similarRoles.length === 0) {
        return [
            "역할을 찾지 못했습니다.",
            "실제 역할 멘션을 선택하거나 서버에 있는 정확한 역할명을 입력해주세요.",
        ].join("\n");
    }

    return [
        "역할을 찾지 못했습니다.",
        `비슷한 역할: ${similarRoles.join(", ")}`,
        "실제 역할 멘션을 선택하거나 서버에 있는 정확한 역할명을 입력해주세요.",
    ].join("\n");
}

async function persistStore() {
    await saveStore(store);
}

client.login(process.env.DISCORD_TOKEN);
