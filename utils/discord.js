const { ChannelType } = require("discord.js");

async function respond(message, content) {
    return message.channel.send(content);
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

function normalizeRoleInput(value) {
    return value.replace(/^@+/, "").trim();
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
        message.guild.roles.cache.find(
            (role) =>
                role.name.replace(/\s+/g, "") ===
                normalized.replace(/\s+/g, "")
        ) ||
        message.guild.roles.cache.find(
            (role) => role.name.toLowerCase() === normalized.toLowerCase()
        )
    );
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

function guildEmojiToStorage(emoji) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

function isUnicodeEmoji(value) {
    return /\p{Extended_Pictographic}/u.test(value);
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

module.exports = {
    formatEmojiLabel,
    getReactionIdentifier,
    matchesEmoji,
    normalizeRoleInput,
    resolveChannel,
    resolveEmoji,
    resolveRole,
    respond,
    splitByPipe,
};
