const { COMMAND_PREFIX } = require("../config/constants");
const { respond } = require("../utils/discord");
const {
    addPanelItem,
    createPanel,
    deletePanel,
    explainManagedHeader,
    getHelpMessage,
    listPanels,
    previewPanel,
    publishPanel,
    removePanelItem,
    updatePanelDescription,
} = require("../services/panelService");

async function handlePanelCommands(message, lines) {
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
        case "헤더":
            await explainManagedHeader(message, rest);
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

module.exports = {
    handlePanelCommands,
};
