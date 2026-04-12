const { log } = require('./utils');

function makePackets(client, bot) {
    let currentStateId = 0;

    client.on('window_items', (packet) => {
        if (packet.stateId !== undefined) {
            currentStateId = packet.stateId;
        }
    });

    client.on('set_slot', (packet) => {
        if (packet.stateId !== undefined) {
            currentStateId = packet.stateId;
        }
    });

    return {
        sendMessage: function (text) {
            try {
                if (client.chat) {
                    client.chat(text);
                } else {
                    client.write('chat', { message: text });
                }
            } catch (error) {
                log(`[Packets] Failed to send message: ${error.message}`, "warn");
            }
        },

        // 1.21.11: cursorItem is `option HashedSlot` — null means "no item"
        click: function (slot, windowId) {
            try {
                client.write('window_click', {
                    windowId: windowId,
                    stateId: currentStateId,
                    slot: slot,
                    mouseButton: 0,
                    mode: 0,
                    changedSlots: [],
                    cursorItem: undefined
                });
                this.actionID++;
            } catch (error) {
                log(`[Packets] Window click failed: ${error.message}`, "warn");
            }
        },

        shiftClick: function (slot, windowId) {
            try {
                client.write('window_click', {
                    windowId: windowId,
                    stateId: currentStateId,
                    slot: slot,
                    mouseButton: 0,
                    mode: 1,
                    changedSlots: [],
                    cursorItem: undefined
                });
                this.actionID++;
            } catch (error) {
                log(`[Packets] Shift-click failed: ${error.message}`, "warn");
            }
        },

        bump: function () {
            this.actionID++;
        },

        getStateId: function () {
            return currentStateId;
        },

        setStateId: function (stateId) {
            currentStateId = stateId;
        },

        confirmClick: function (windowID) {
            // no-op in 1.17+ (stateId replaces transaction confirmations)
        },

        closeWindow: function (windowId) {
            try {
                client.write('close_window', { windowId: windowId });
            } catch (error) {
                log(`[Packets] Error closing window: ${error.message}`, "warn");
            }
        },

        actionID: 1
    };
}

module.exports = { makePackets };
