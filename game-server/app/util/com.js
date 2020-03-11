const logger = require('pomelo-logger').getLogger('m-debug',__filename);

exports.normalErr = (err) => {
    console.log(err);
    logger.error(err);
    return false;
};

function isNumber(n) {
    return (typeof n === 'number');
}

exports.isNumber = isNumber;

function isString(s) {
    return (typeof s === 'string');
}

exports.isString = isString;

//获取当前时间戳(秒)
function timest(flag) {
    const tmp = Date.parse(new Date()) / 1000;
    if (!flag) {
        return tmp.toString();
    }
    return parseInt(tmp);
}

exports.timest = timest;

//自定义获取当前时间戳,默认秒
function custimest(flag = 1000) {
    flag = isNumber(flag) ? (flag > 0 ? flag : 1) : 1;
    let now = new Date();
    const tmp = now.getTime() / flag;
    return parseInt(tmp);
}

exports.custimest = custimest;

function generateSixId() {
    let roomId = '';
    for (let i = 0; i < 6; i += 1) {
        roomId += Math.floor(Math.random() * 10);
    }
    return roomId;
}

exports.generateSixId = generateSixId;

exports.deepCopy = function (source) {
    const result = {};

    for (const key in source) {
        result[key] = typeof source[key] === 'object' ? deepCopy(source[key]) : source[key];
    }
    return result;
};
exports.deepCopyArr = function (source) {
    const arr = [];
    for (let i = 0; i < source.length; i++) {
        arr.push(source[i]);
    }
    return arr;
};

function isEmptyObj(obj) {
    for (t in obj) {
        return false;
    }
    return true;
}

exports.isEmptyObj = isEmptyObj;


function getfakeIP() {
    const getfakeIpNum = function () {
        return Math.floor(Math.random() * 255);
    };
    let ip = `::ffff:${getfakeIpNum()}.${getfakeIpNum()}.${getfakeIpNum()}.${getfakeIpNum()}`;
    return ip;
}

exports.getfakeIP = getfakeIP;

function customSleep(time = 0) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, time);
    });
}

exports.customSleep = customSleep;
