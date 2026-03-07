const { PANEL_HEADER_NAMES } = require("../config/constants");
const {
    getGuildPanels,
    getPanel,
    getPublishedMessage,
    persistStore,
    setPublishedMessage,
} = require("../store/runtimeStore");
const {
    formatEmojiLabel,
    getReactionIdentifier,
    matchesEmoji,
    normalizeRoleInput,
    resolveChannel,
    resolveEmoji,
    resolveRole,
    respond,
    splitByPipe,
} = require("../utils/discord");

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

async function explainManagedHeader(message, rest) {
    const [panelName] = splitByPipe(rest, 2);
    if (!panelName) {
        await respond(message, "사용법: `!패널 헤더 패널이름`");
        return;
    }

    const panel = getPanel(message.guild.id, panelName);
    if (!panel) {
        await respond(message, "해당 패널을 찾을 수 없습니다.");
        return;
    }

    await respond(
        message,
        [
            `패널 \`${panelName}\` 헤더는 서버 역할 순서 기준으로 관리합니다.`,
            getPanelHeaderName(panelName)
                ? `현재 적용 헤더: \`${getPanelHeaderName(panelName)}\``
                : "이 패널은 자동 헤더 대상이 아닙니다.",
        ].join("\n")
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

    const role = resolveRole(message, roleInput);
    if (!role) {
        await respond(message, buildRoleNotFoundMessage(message, roleInput));
        return;
    }

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
        `패널 \`${panelName}\`에 \`${role.name}\` 역할과 ${formatEmojiLabel(
            emoji
        )} 이모지를 연결했습니다.`
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

    const targetChannel = resolveChannel(message, channelInput) || message.channel;
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

    setPublishedMessage(roleMessage.id, {
        guildId: message.guild.id,
        channelId: targetChannel.id,
        panelName: panel.name,
    });
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
        const published = getPublishedMessage(message.id);

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

        const headerRole = await ensurePanelHeaderRole(message.guild, panel);

        if (action === "add" && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }

        if (action === "add" && headerRole && !member.roles.cache.has(headerRole.id)) {
            await member.roles.add(headerRole);
        }

        if (action === "remove" && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
        }

        if (action === "remove" && headerRole) {
            const remainingRoleIds = new Set(member.roles.cache.keys());
            remainingRoleIds.delete(role.id);
            const hasAnyPanelRole = panel.items.some((item) =>
                remainingRoleIds.has(item.roleId)
            );

            if (!hasAnyPanelRole && member.roles.cache.has(headerRole.id)) {
                await member.roles.remove(headerRole);
            }
        }
    } catch (error) {
        console.error("역할 반응 처리 실패:", error);
    }
}

async function ensurePanelHeaderRole(guild, panel) {
    const headerRoleName = getPanelHeaderName(panel.name);
    if (!headerRoleName) {
        sanitizeLegacyHeaderFields(panel);
        return null;
    }

    const role =
        guild.roles.cache.find((item) => item.name === headerRoleName) ||
        (panel.headerRoleId
            ? await guild.roles.fetch(panel.headerRoleId).catch(() => null)
            : null) ||
        (panel.headerRoleName
            ? guild.roles.cache.find((item) => item.name === panel.headerRoleName)
            : null);

    sanitizeLegacyHeaderFields(panel);
    return role;
}

function renderPanel(panel, guild) {
    return [
        `<${panel.name}>`,
        panel.description,
        "",
        ...panel.items.map((item) => {
            const roleName =
                guild.roles.cache.get(item.roleId)?.name || item.roleName;
            return `${roleName} (${formatEmojiLabel(item.emoji)})`;
        }),
    ]
        .filter(Boolean)
        .join("\n");
}

function getHelpMessage() {
    return [
        "패널 명령어:",
        "- `!패널 생성 패널이름`",
        "- `!패널 헤더 패널이름`",
        "- `!패널 설명 패널이름 | 설명`",
        "- `!패널 추가 패널이름 | @역할 또는 역할명 | 이모지`",
        "- `!패널 제거 패널이름 | @역할 또는 역할명`",
        "- `!패널 보기 패널이름`",
        "- `!패널 목록`",
        "- `!패널 발행 패널이름 | #채널`",
        "- `!패널 삭제 패널이름`",
        "",
        "예시:",
        "- `!패널 생성 언어선택`",
        "- `!패널 헤더 언어선택`",
        "- `!패널 설명 언어선택 | 여러분이 주로 사용하는 언어를 골라주세요!`",
        "- `!패널 추가 언어선택 | @Python | <:python:123456789012345678>`",
        "- `!패널 발행 언어선택 | #역할선택`",
    ].join("\n");
}

function getPanelHeaderName(panelName) {
    return PANEL_HEADER_NAMES[panelName] || null;
}

function sanitizeLegacyHeaderFields(panel) {
    delete panel.headerRoleId;
    delete panel.headerRoleName;
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

module.exports = {
    addPanelItem,
    createPanel,
    deletePanel,
    explainManagedHeader,
    getHelpMessage,
    handleReactionRole,
    listPanels,
    previewPanel,
    publishPanel,
    removePanelItem,
    updatePanelDescription,
};
