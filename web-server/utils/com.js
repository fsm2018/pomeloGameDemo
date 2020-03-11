
exports.normalErr = (err) => {
    console.error(err);
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

function timest(flag) {
    const tmp = Date.parse(new Date()) / 1000;
    if (!flag) {
        return tmp.toString();
    }
    return parseInt(tmp);
}

exports.timest = timest;

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


exports.randChat = function (len) {
    len = len || 32;
    const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'; /** **默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1*** */
    const maxPos = $chars.length;
    let pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
};
