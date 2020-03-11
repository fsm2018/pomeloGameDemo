var cards = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D,
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D,
    0x4E, 0x4F];

exports.getCards = function () {
    return cards;
};
// 方块
const Diamonds = 0x0;
// 梅花
const Clubs = 0x1;
// 红桃
const Hearts = 0x2;
// 黑桃
const Spades = 0x3;
// 王
const King = 0x4;
// 财神
const Magic = 0x5;

// 获取牌的花色
function getCardType(card) {
    return card >> 4;
}

exports.getCardType = getCardType;

// 获取牌的面值
function getCardValue(card) {
    return card & 0x0F;
}

exports.getCardValue = getCardValue;

// PrintfCardType 打印扑克牌花
exports.printfCardType = (card) => {
    const t = getCardType(card);
    switch (t) {
        case Diamonds:
            return "♦️";
        case Clubs:
            return "♣️";
        case Hearts:
            return "♥️";
        case Spades:
            return "♠️";
        case King:
            return "★";
        case Magic:
            return "☆";
    }
    return "@";
};

// PrintfCardValue 打印扑克牌值
exports.printfCardValue = (card) => {
    const v = getCardValue(card);
    switch (v) {
        case 0x1:
            return "A";
        case 0x2:
            return "2";
        case 0x3:
            return "3";
        case 0x4:
            return "4";
        case 0x5:
            return "5";
        case 0x6:
            return "6";
        case 0x7:
            return "7";
        case 0x8:
            return "8";
        case 0x9:
            return "9";
        case 0xA:
            return "10";
        case 0xB:
            return "J";
        case 0xC:
            return "Q";
        case 0xD:
            return "K";
        case 0xE:
            return "-";
        case 0xF:
            return "+";
        case 0x0:
            return "";
    }
    return "#";
};

// PrintfCard 打印扑克牌
exports.printfCard = (card) => {
    return "[" + exports.printfCardType(card) + exports.printfCardValue(card) + "]";
};

// PrintfCardsArr 打印扑克牌数组
exports.printfCardsArr = (cards) => {
    let txt = "{";
    cards.forEach((card) => {
        txt += exports.printfCard(card);
    });
    txt += "}";
    return txt;
};

// 检查是否有王
function checkKing(map) {
    return map[0xE] > 0 || map[0xF] > 0;

}

// 检测是否为顺子
function checkSingle(arr) {
    for (let i = 0; i < arr.length - 1; i += 1) {
        const card = arr[i];
        const v1 = getCardValue(card);
        const v2 = getCardValue(arr[i + 1]);
        if (v1 == 2 || v2 == 2) {
            return false;
        }
        if ((v1 == 1 && v2 == 13) || (v1 == 13 && v2 == 1)) {

        } else if (v2 + 1 !== v1 && v1 + 1 !== v2) {
            return false;
        }
    }

    return true;
}

// 对比面值大小
function compareValue(v1, v2) {
    if (v1 <= 0 || v2 <= 0) {
        return false;
    }
    if (v1 > 2 && v1 <= 13 && v2 <= 2) {
        return false;
    } else if (v1 <= 2 && v2 > 2 && v2 <= 13) {
        return true;
    } else if (v1 > v2) {
        return true;
    }
    return false;
}

exports.compareValue = compareValue;

// 对比两张牌大小
function compareCard(c1, c2) {
    return compareValue(getCardValue(c1), getCardValue(c2));
}

// 排序
function bubbleSort(a) {
    const arr = a;
    const len = arr.length;
    for (let i = 0; i < len; i += 1) {
        for (let j = 0; j < len - 1 - i; j += 1) {
            if (compareCard(arr[j], arr[j + 1])) { // 相邻元素两两对比
                const temp = arr[j + 1]; // 元素交换
                arr[j + 1] = arr[j];
                arr[j] = temp;
            }
        }
    }
    return arr;
}

exports.bubbleSort = bubbleSort;

// PatternNone 未知
exports.PatternNone = 0;
// PatternKingBomb 天王炸
exports.PatternKingBomb = 1;
// PatternKingBomb 普通炸
exports.PatternBomb = 2;
// PatternSin 单牌
exports.PatternSin = 3;
// PatternDou 对子
exports.PatternDou = 4;
// PatternTri 三张
exports.PatternTri = 5;
// PatternSinList 单顺
exports.PatternSinList = 6;
// PatternDouList 双顺
exports.PatternDouList = 7;
// PatternTriList 三顺
exports.PatternTriList = 8;
// PatternTriList2 三顺带双
exports.PatternTriList2 = 9;

const filters = {};
filters[exports.PatternKingBomb] = ({arr, map}) => {
    if (arr.length != 4) {
        return false;
    }
    if (map[0x0E] == 2 && map[0x0F] == 2) {
        return true;
    }
    return false;
};

filters[exports.PatternBomb] = ({arr, map}) => {
    if (arr.length < 4) {
        return false;
    }
    if (checkKing(map)) {
        return false;
    }
    const keys = Object.keys(map);
    if (keys.length != 1) {
        return false;
    }
    var big = getCardValue(arr[0]);
    if (!big) return false;
    return big;
};

filters[exports.PatternSin] = ({arr, map}) => {
    if (arr.length !== 1) {
        return false;
    }

    const big = getCardValue(arr[0]);
    if (!big) return false;
    return big;
};

filters[exports.PatternDou] = ({arr, map}) => {
    if (arr.length !== 2) {
        return false;
    }

    if (getCardValue(arr[0]) != getCardValue(arr[1])) {
        return false;
    }

    const big = getCardValue(arr[0]);
    if (!big) return false;
    return big;
};

filters[exports.PatternTri] = ({arr, map}) => {
    if (arr.length !== 3) {
        return false;
    }

    if (checkKing(map)) {
        return false;
    }

    const big = getCardValue(arr[0]);
    const keys = Object.keys(map);
    if (keys.length != 1) {
        return false;
    }
    if (!big) return false;

    return big;
};

filters[exports.PatternSinList] = ({arr, map}) => {
    if (arr.length < 5 || arr.length > 12) {
        return false;
    }

    if (checkKing(map)) {
        return false;
    }
    bubbleSort(arr);
    if (!checkSingle(arr)) return false;

    const big = getCardValue(arr[arr.length - 1]);
    if (!big) return false;

    return big;
};

filters[exports.PatternDouList] = ({arr, map}) => {
    if (arr.length < 6 || arr.length % 2 !== 0) {
        return false;
    }

    if (checkKing(map)) {
        return false;
    }

    for (let i in map) {
        if (map[i] !== 2) {
            return false;
        }
    }
    const list = [];

    for (let i = 0; i < arr.length; i += 1) {
        if (i % 2 === 0) {
            list.push(arr[i]);
        }
    }

    bubbleSort(list);
    if (!checkSingle(list)) return false;

    const big = getCardValue(list[list.length - 1]);
    if (!big) return false;
    return big;
};

filters[exports.PatternTriList] = ({arr, map}) => {
    if (arr.length < 9 || arr.length % 3 !== 0) {
        return false;
    }

    if (checkKing(map)) {
        return false;
    }

    for (var i in map) {
        if (map[i] !== 3) {
            return false;
        }
    }

    const list = [];
    for (let i = 0; i < arr.length; i += 1) {
        if (i % 3 === 0) {
            list.push(arr[i]);
        }
    }


    bubbleSort(list);
    if (!checkSingle(list)) return false;

    const big = getCardValue(list[list.length - 1]);
    if (!big) return false;

    return big;
};

filters[exports.PatternTriList2] = ({arr, map}) => {
    if (arr.length % 5 !== 0 || arr.length < 15) {
        return false;
    }
    if (checkKing(map)) {
        return false;
    }

    let c1 = 0;
    let c2 = 0;
    const list = [];
    const doubleList = [];
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i += 1) {
        const card = keys[i];
        if (map[card] === 5) {
            c1 += 1;
            list.push(card);
            c2 += 1;
            doubleList.push(card);
        } else if (map[card] === 3) {
            c1 += 1;
            list.push(card);
        } else if (map[card] === 2) {
            c2 += 1;
            doubleList.push(card);
        } else {
            return false;
        }
    }

    if (c1 !== c2) {
        return false;
    }

    bubbleSort(list);
    bubbleSort(doubleList);
    if (!checkSingle(list)) return false;
    if (!checkSingle(doubleList)) return false;

    const big = getCardValue(list[list.length - 1]);
    if (!big) return false;

    return big;
};

// 获取牌的类型
exports.getCardsType = (ctx) => {
    const keys = Object.keys(filters);
    // 循环检测每种牌型是否成立
    for (let i = 0; i < keys.length; i += 1) {
        const pattern = parseInt(keys[i]);
        const big = filters[pattern](ctx);
        if (big) {
            return {pattern, big};
        }
    }
    return null;
};
exports.getCardsMap = function (cards) {
    var map = {};
    for (var i = 0; i < cards.length; i++) {
        var value = getCardValue(cards[i]);
        if (!map[value]) {
            map[value] = 0;
        }
        map[value]++;
    }
    return map;
};
