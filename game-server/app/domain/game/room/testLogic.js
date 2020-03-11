const pomelo = require('pomelo');
const codeConfig = require('../../../../../shared/codeConfig');

function shuffle(mahjongs, conf) {
    // 筒 (0 ~ 8 表示筒子
    var index = 0;
    for (var i = 0; i < 9; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    // 条 9 ~ 17表示条子
    for (var i = 9; i < 18; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    // 万 18 ~ 26表示万
    for (var i = 18; i < 27; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    if (conf.gametype == codeConfig.gameType.pushing_hz && (conf.wanfa % 4300 == 1 || conf.wanfa % 4400 == 1)) {

    } else {
        // 风 27 ~ 33表示风 东西南北中发白
        for (var i = 27; i < 34; ++i) {
            for (var c = 0; c < 4; ++c) {
                mahjongs[index] = i;
                index++;
            }
        }
    }

    for (var i = 0; i < mahjongs.length; ++i) {
        const lastIndex = mahjongs.length - 1 - i;
        var index = Math.floor(Math.random() * lastIndex);
        const t = mahjongs[index];
        mahjongs[index] = mahjongs[lastIndex];
        mahjongs[lastIndex] = t;
    }
}

const redis = pomelo.app.get('rdclient');

async function getMJTestCard(conf) {

    let handCards = [];
    let maCards = [];

    const mahjongs = [];
    shuffle(mahjongs, conf);

    let rdstestCards = await redis.getTestCards('MJ');
    if (rdstestCards) {
        for (let key in rdstestCards) {
            let testcards = rdstestCards[key].split(",");
            if (conf.gametype == codeConfig.gameType.pushing_hz &&
                (conf.wanfa % 4300 == 2 || conf.wanfa % 4400 == 2) &&
                testcards.length > conf.peoplemax * 13) {
                let index = conf.peoplemax * 13;
                let tp = testcards.splice(index, conf.peoplemax);
                maCards.push(...tp);
            }
            handCards.push(testcards);
        }
    } else {
        return mahjongs;
    }

    let cards = [];


    for (let i = 0; i < handCards.length; i++) {
        for (let j = 0; j < handCards[i].length; j++) {
            let card = parseInt(handCards[i][j]);
            cards.push(card);
            let index = mahjongs.indexOf(card);
            mahjongs.splice(index, 1);
        }
    }

    for (let i = 0; i < maCards.length; i++) {
        let card = parseInt(maCards[i]);
        let index = mahjongs.indexOf(card);
        mahjongs.splice(index, 1);
        mahjongs.splice(mahjongs.length, 0, card);
    }

    for (let i = 0; i < mahjongs.length; i++) {
        let card = mahjongs[i];
        cards.push(card);
    }
    return cards;
}

exports.getMJTestCard = getMJTestCard;

const db_bk_Logic = require('../double_buckle/hz/db_bk_hz_logic');

function shuffleDBuckle(pokers) {
    const cards = db_bk_Logic.getCards();
    let count = 0;
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < cards.length; j++) {
            pokers[count] = cards[j];
            count += 1;
        }
    }

    for (let i = 0; i < pokers.length; i += 1) {
        const lastIndex = pokers.length - 1 - i;
        const index = Math.floor(Math.random() * lastIndex);
        const t = pokers[index];
        pokers[index] = pokers[lastIndex];
        pokers[lastIndex] = t;
    }
}

async function getDBuckleTestCard() {
    let handCards = [];

    const pokers = new Array(108);
    shuffleDBuckle(pokers);

    let rdstestCards = await redis.getTestCards('DBuckle');
    if (rdstestCards) {
        for (let key in rdstestCards) {
            let testcards = rdstestCards[key].split(",");
            handCards.push(testcards);
        }
    } else {
        return pokers;
    }

    let cards = [];


    for (let i = 0; i < handCards.length; i++) {
        for (let j = 0; j < handCards[i].length; j++) {
            let card = parseInt(handCards[i][j]);
            cards.push(card);
            let index = pokers.indexOf(card);
            pokers.splice(index, 1);
        }
    }
    for (let i = 0; i < pokers.length; i++) {
        let card = pokers[i];
        cards.push(card);
    }
    return cards;
}

exports.getDBuckleTestCard = getDBuckleTestCard;

