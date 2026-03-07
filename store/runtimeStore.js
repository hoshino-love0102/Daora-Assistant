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

function setPublishedMessage(messageId, value) {
    store.publishedMessages[messageId] = value;
}

async function persistStore() {
    await saveStore(store);
}

module.exports = {
    getGuildPanels,
    getPanel,
    getPublishedMessage,
    getStore,
    initializeStore,
    persistStore,
    setPublishedMessage,
};
