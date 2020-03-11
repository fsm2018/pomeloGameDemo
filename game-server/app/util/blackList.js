const pomelo = require('pomelo');
const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const fs = require('fs');

var blackList = [];

exports.blackListFun = function (cb) {
    cb(false, blackList);
};

var addrConnectMap = {};
var ConnectInterval = null;

function init(app) {
    if (app.getServerType() == 'gate' || app.getServerType() == 'connector') {
        try {
            let txt = fs.readFileSync(app.getBase() + `/logs/blacklist-${app.getServerId()}.txt`, 'utf8');
            blackList = txt.split(',');
        } catch (e) {
            blackList = [];
        }
    }
    addrConnectMap = {};
    if (ConnectInterval)
        clearInterval(ConnectInterval);
    ConnectInterval = setInterval(() => {
        for (let key in addrConnectMap) {
            if (addrConnectMap.hasOwnProperty(key)) {
                delete addrConnectMap[key];
            }
        }
    }, 1000);
}

exports.init = init;

function addConnect(ip) {
    let addrInfo = addrConnectMap[ip];
    if (addrInfo) {
        addrInfo.TempConnectCount++;
        addrInfo.AllConnectCount++;
        if (addrInfo.AllConnectCount >= 80) {
            return -2;
        }
        if (addrInfo.TempConnectCount >= 20) {
            return -1;
        }
    } else {
        addrInfo = addrConnectMap[ip] = {};
        addrInfo.TempConnectCount = 1;
        addrInfo.AllConnectCount = 1;
    }
    return 0;
}

exports.addConnect = addConnect;

function clearTempConnect(ip) {
    let addrInfo = addrConnectMap[ip];
    if (addrInfo) {
        addrInfo.TempConnectCount = 0;
    } else {
        addrInfo = addrConnectMap[ip] = {};
        addrInfo.TempConnectCount = 0;
    }
}

exports.clearTempConnect = clearTempConnect;

function clearAllConnect(ip) {
    let addrInfo = addrConnectMap[ip];
    if (addrInfo) {
        addrInfo.AllConnectCount = 0;
    } else {
        addrInfo = addrConnectMap[ip] = {};
        addrInfo.AllConnectCount = 0;
    }
}

exports.clearAllConnect = clearAllConnect;



