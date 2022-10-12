class _API {
    static HOST         = 'https://localhost:5500';
    static NODE_API     = `${_API.HOST}/api`;
    static HOST_TANGLED = 'https://localhost:15555';
    static TANGLED_API  = `${_API.HOST_TANGLED}/api`;

    constructor() {
        this.nodeID             = undefined;
        this.nodeSignature      = undefined;
        this.apiHealthCheckFail = 0;
    }

    setNodeID(nodeID) {
        this.nodeID = nodeID;
    }

    setNodeSignature(nodeSignature) {
        this.nodeSignature = nodeSignature;
    }

    getAuthenticatedURL() {
        if (!this.nodeID || !this.nodeSignature) {
            throw Error('api is not ready');
        }
        return `${_API.NODE_API}/${this.nodeID}/${this.nodeSignature}`;
    }

    getTangledURL() {
        return `${_API.TANGLED_API}`;
    }

    apiHealthCheck() {
        try {
            return fetch(`${_API.HOST}`)
                .then(response => {
                    if (this.apiHealthCheckFail >= 4) {
                        send_window_parent_post_message('node_restarted');
                    }
                    this.apiHealthCheckFail = 0;
                    return response.json();
                }).catch(e => {
                    this.apiHealthCheckFail++;
                    if (this.apiHealthCheckFail === 4) {
                        send_window_parent_post_message('node_error');
                    }
                    throw e;
                });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getLastTransaction(addressKeyIdentifier) {
        try {
            return fetch(this.getAuthenticatedURL() + `/FDLyQ5uo5t7jltiQ?p3=${addressKeyIdentifier}&p14=1`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    sendTransaction(transactionOutputPayload) {
        try {
            return fetch(this.getAuthenticatedURL() + `/XPzc85T3reYmGro1?p0=${JSON.stringify(transactionOutputPayload)}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getTransactionHistory(addressKeyIdentifier) {
        try {
            return fetch(this.getAuthenticatedURL() + `/w9UTTA7NXnEDUXhe?p0=${addressKeyIdentifier}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getTransaction(transactionID, shardID) {
        try {
            return fetch(this.getAuthenticatedURL() + `/IBHgAmydZbmTUAe8?p0=${transactionID}&p1=${shardID}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getNodeStat() {
        try {
            return fetch(this.getAuthenticatedURL() + '/rKclyiLtHx0dx55M')
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getRandomMnemonic() {
        try {
            return fetch(this.getAuthenticatedURL() + '/Gox4NzTLDnpEr10v')
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getFreeOutputs(addressKeyIdentifier) {
        try {
            return fetch(this.getAuthenticatedURL() + `/FDLyQ5uo5t7jltiQ?p3=${addressKeyIdentifier}&p4=0&p7=1&p10=0`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    verifyAddress(address) {
        try {
            return fetch(this.getAuthenticatedURL() + `/Xim7SaikcsHICvfQ?p0=${address}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    newSessionWithPhrase(password, mnemonicPhrase) {
        try {
            return fetch(this.getAuthenticatedURL() + `/GktuwZlVP39gty6v?p0=${password}&p1=${mnemonicPhrase}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    newSession(password) {
        try {
            return fetch(this.getAuthenticatedURL() + `/PMW9LXqUv7vXLpbA?p0=${password}`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getSession() {
        try {
            return fetch(this.getAuthenticatedURL() + '/OBexeX0f0MsnL1S3')
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getNextAdvertisementToRender() {
        try {
            return fetch(this.getTangledURL() + '/LMCqwVXTLS7VRWPT')
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getLastTransactionTimestamp() {
        try {
            return fetch(this.getTangledURL() + `/AQ82j88MiEyoe3zi`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    getTotalAdvertismentPayment() {
        try {
            return fetch(this.getTangledURL() + `/JXPRrbJlwOMnDzjr`)
                .then(response => response.json());
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

}


const API = new _API();

document.addEventListener('DOMContentLoaded', () => {
    send_window_parent_post_message('initialize');
});

let readStatHandlerID    = null;
let addressKeyIdentifier = null;

function get_parent_frame_id() {
    return typeof (config.parent_frame_id) !== 'undefined' ? config.parent_frame_id : 'tangled://millix-bar';
}

function send_window_parent_post_message(type, data = null) {
    return window.parent.postMessage({
        type: type,
        data: data
    }, get_parent_frame_id());
}

function readStat() {
    clearTimeout(readStatHandlerID);
    API.getNodeStat()
       .then(data => {
           send_window_parent_post_message('node_stat', data);

           if (!addressKeyIdentifier) {
               return API.getSession()
                         .then(data => {
                             if (data.wallet) {
                                 addressKeyIdentifier = data.wallet.address_key_identifier;
                                 return API.getLastTransaction(addressKeyIdentifier)
                                           .then(data => send_window_parent_post_message('last_transaction', data[0]));
                             }
                         });
           }

           return API.getLastTransaction(addressKeyIdentifier)
                     .then(data => send_window_parent_post_message('last_transaction', data[0]));
       })
       .then(() => readStatHandlerID = setTimeout(() => readStat(), 1000))
       .catch(() => readStatHandlerID = setTimeout(() => readStat(), 1000));
}

let apiCheckHandlerID = null;

function apiCheck() {
    apiCheckHandlerID = true;
    API.apiHealthCheck()
       .then(() => apiCheckHandlerID = setTimeout(() => apiCheck(), 2500))
       .catch(() => apiCheckHandlerID = setTimeout(() => apiCheck(), 2500));
}

window.addEventListener('message', ({data}) => {
    switch (data.type) {
        case 'api_config':
            API.setNodeID(data.node_id);
            API.setNodeSignature(data.node_signature);
            break;
        case 'get_session':
            API.getSession()
               .then(data => {
                   if (data.wallet) {
                       addressKeyIdentifier = data.wallet.address_key_identifier;
                   }
                   send_window_parent_post_message('millix_session', data);
               }).catch(_ => setTimeout(() => window.postMessage({type: 'get_session'}), 1000));
            break;
        case 'new_session':
            API.newSession(data.password)
               .then(data => {
                   if (data.wallet) {
                       addressKeyIdentifier = data.wallet.address_key_identifier;
                   }
                   send_window_parent_post_message('millix_session', data);
               });
            break;
        case 'get_transaction':
            API.getTransaction(data.transaction_id, data.shard_id)
               .then(data => {
                   send_window_parent_post_message('new_transaction', data);
               });
            break;
        case 'get_last_transaction_timestamp':
            API.getLastTransactionTimestamp()
               .then(data => send_window_parent_post_message('last_transaction_timestamp', data));
            break;
        case 'get_total_advertisement_payment':
            API.getTotalAdvertismentPayment()
               .then(data => send_window_parent_post_message('total_advertisment_payment', data));
            break;
        case 'read_stat_start':
            if (!readStatHandlerID) {
                readStat();
            }
            break;
        case 'read_stat_stop':
            if (readStatHandlerID) {
                clearTimeout(readStatHandlerID);
                readStatHandlerID = null;
            }
            break;
        case 'get_next_tangled_advertisement':
            API.getNextAdvertisementToRender()
               .then(data => send_window_parent_post_message('next_tangled_advertisement', data))
               .catch(() => send_window_parent_post_message('next_tangled_advertisement'));
            break;
        case 'api_check':
            if (!apiCheckHandlerID) {
                setTimeout(() => apiCheck(), 15000); // start api check after 15s
            }
            break;
    }
});
