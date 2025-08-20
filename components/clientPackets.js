// completly from tpm, nothing really to improve for packet level clicks
function makePackets(client) {
    return {
        sendMessage: function (text) {
            client.write('chat', {
                message: text
            }) // sends message 
        },
        click: function (slot, id, itemID) {
            client.write('window_click', {
                windowId: id,
                slot: slot,
                mouseButton: 2,
                mode: 3,
                item: { "blockId": itemID }, // typically -1 
                action: this.actionID
            })
            this.actionID++;
        },
        bump: function () {
            this.actionID++;
        },
        confirmClick: function (windowID) {
            client.write('transaction', {
                windowId: windowID,
                action: this.actionID,
                accepted: true
            })
        },
        actionID: 1
    }
}

module.exports = { makePackets };