const { loadStore, saveStore } = require("../panelStore");

let store = {
    panels: {},
    publishedMessages: {},
};

async function initializeStore() {
    store = await loadStore();
    return store;
}

function getStore() {
    return store;
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

function getPublishedMessage(messageId) {
    return store.publishedMessages[messageId];
}

function getPublishedPanelMessages(guildId, panelName) {
    return Object.entries(store.publishedMessages)
        .filter(
            ([, value]) =>
                value.guildId === guildId && value.panelName === panelName
        )
        .map(([messageId, value]) => ({
            messageId,
            ...value,
        }))
        .sort((a, b) => {
            const left = BigInt(a.messageId);
            const right = BigInt(b.messageId);

            if (right === left) {
                return 0;
            }

            return right > left ? 1 : -1;
        });
}

function setPublishedMessage(messageId, value) {
    store.publishedMessages[messageId] = value;
}

function removePublishedMessage(messageId) {
    delete store.publishedMessages[messageId];
}

async function persistStore() {
    await saveStore(store);
}

module.exports = {
    getGuildPanels,
    getPanel,
    getPublishedPanelMessages,
    getPublishedMessage,
    getStore,
    initializeStore,
    persistStore,
    removePublishedMessage,
    setPublishedMessage,
};
