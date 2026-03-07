const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "role-panels.json");

const DEFAULT_STORE = {
    panels: {},
    publishedMessages: {},
};

async function ensureStore() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
        await fs.access(STORE_PATH);
    } catch {
        await fs.writeFile(
            STORE_PATH,
            JSON.stringify(DEFAULT_STORE, null, 2),
            "utf8"
        );
    }
}

async function loadStore() {
    await ensureStore();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
        panels: parsed.panels || {},
        publishedMessages: parsed.publishedMessages || {},
    };
}

async function saveStore(store) {
    await ensureStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

module.exports = {
    loadStore,
    saveStore,
};
