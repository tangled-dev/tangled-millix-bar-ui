const config = {
    parent_frame_id: '*',
    child_frame_id : '*'
};

const cr = {
    define(n, f) {
        globalThis[n] = f();
    },
    addWebUIListener() {
    }
};

const loadTimeData = {
    getBoolean() {
        return false;
    }
};

chrome.send = () => {
};

const NODE_ID        = undefined;
const NODE_SIGNATURE = undefined;
if (!NODE_ID || !NODE_SIGNATURE) {
    throw Error('NODE_ID and NODE_SIGNATURE must be defined');
}
setTimeout(() => {
    millix_bar.connectToWallet({
        node_id       : NODE_ID,
        node_signature: NODE_SIGNATURE
    });
    millix_bar.activateWallet();
    millix_bar.refreshThemeStyles({is_dark_theme: true});
}, 1000);
