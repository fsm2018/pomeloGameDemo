const pomelo = require('pomelo');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const com = require('../../../../util/com');
const codeConfig = require('../../../../../../shared/codeConfig');
const gameRetCode = codeConfig.gameRetCode;

const gameBase = require('../../base/gameBase');
const db_bk_Logic = require('./db_bk_hz_logic');


const WinType = {
    default: -1,
    doubel_buckle: 0,
    single_buckle: 1,
    self_buckle: 2,
};

class Game extends gameBase {
    constructor(roomData) {
        super(roomData);
        this.game.pokers = new Array(108);
        this.game.select_poker = {
            index: -1,
            value: -1,
        };
        this.game.firstSendIndex = 0;
        this.game.lastChu = {
            pai: [], //前一个操作者出得牌
            pattern: db_bk_Logic.PatternNone,
            seatIndex: -1,//前一个操作者出牌位置
        };
        this.game.oldChu = {
            pai: [], //记录前一个有效出得牌
            pattern: db_bk_Logic.PatternNone,
            seatIndex: -1,// 记录前一个有效出牌位置
            userId: 0,
        };
        this.game.lastResult = { //上局输赢
            winType: WinType.default,
            winer:
                {
                    userId: -1,
                    peer: -1,
                    seatIndex: -1,
                }
        };
        this.game.endusers = [];
        this.eachcost *= this.game.roomInfo.conf.gamenums > 8 ? 2 : 1;

        this.gameMod1 = parseInt((this.wanfa % 100) / 10); //1:全明  0:全暗
        this.gameMod2 = this.wanfa % 10; //1:明牌配对 0:长期搭档

        if (roomData.hasOwnProperty('lastResult')) {
            this.game.lastResult = JSON.parse(roomData.lastResult);
        }
    }

    initSeat(userId, i, fsid) {
        const data = {};
        data.seatIndex = i;
        data.userId = userId;
        data.fsid = fsid;
        data.holds = [];
        data.folds = [];
        data.peer = 0;

        data.score = 0;

        data.state = 0; //玩家状态 0:正常  1:出完牌了

        this.game.gameSeats[i] = data;
        this.gameSeatsOfUsers[userId] = data;
    }

    shuffle() {
        const cards = db_bk_Logic.getCards();
        const pokers = this.game.pokers;
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

    deal() {
        const allPokers = this.game.pokers;
        let seatIndex = this.game.firstSendIndex;
        for (let i = 0; i < allPokers.length; i++) {
            let pokers = this.game.gameSeats[seatIndex].holds;
            if (pokers == null) {
                pokers = [];
                this.game.gameSeats[seatIndex].holds = pokers;
            }
            let poker = allPokers[i];
            pokers.push(poker);
            seatIndex += 1;
            seatIndex %= this.max;
        }

        // for (let i = 0; i < this.game.gameSeats.length; i++) {
        //     console.log(db_bk_Logic.printfCardsArr(this.game.gameSeats[i].holds));
        // }
    }

    async begin(testData) {
        let self = this;
        this.game.state = this.gameState.begin;
        const roomInfo = this.game.roomInfo;
        const seats = roomInfo.seats;

        roomInfo.numOfGames += 1;
        // 初始化玩家数据
        this.gameSeatsOfUsers = {};
        this.game.gameSeats = new Array(this.max);
        for (let i = 0; i < this.max; i++) {
            this.initSeat(seats[i].userId, i, seats[i].fsid);
            this.initDissolveInfo(seats[i].userId);
        }
        if (!await this.startGame(testData ? testData.testCards : null)) {
            return false;
        }
        this.game.state = this.gameState.playing;

        //检测房卡
        this.checkGems();
        return true;
    }

    async again(testData) {
        this.game.state = this.gameState.begin;
        const roomInfo = this.game.roomInfo;

        // 重置数据
        this.game.gameIndex = roomInfo.numOfGames;
        this.game.button = roomInfo.nextButton;

        roomInfo.numOfGames += 1;

        // 初始化玩家数据
        this.gameSeatsOfUsers = {};
        this.game.gameSeats = new Array(this.max);
        for (let i = 0; i < this.max; i += 1) {
            this.initSeat(roomInfo.seats[i].userId, i, roomInfo.seats[i].fsid);
        }
        if (!await this.startGame(testData ? testData.testCards : null)) {
            return false;
        }
        this.game.state = this.gameState.playing;
        return true;
    }

    async startGame(testData) {
        this.game.raise = this.game.conf.raise || 1;
        this.game.select_poker.index = -1;
        this.game.select_poker.value = -1;
        this.game.endusers = [];
        if (testData) {
            this.game.pokers = testData;
        } else {
            this.shuffle();
        }
        const pokers_length = this.game.pokers.length;
        if (this.game.lastResult.winType === WinType.default ||
            this.game.lastResult.winType === WinType.doubel_buckle) {
            this.game.select_poker.index = Math.floor(Math.random() * pokers_length);
            this.game.select_poker.value = this.game.pokers[this.game.select_poker.index];
            //定庄
            this.game.firstSendIndex = db_bk_Logic.getCardValue(this.game.select_poker.value) % this.max;
            this.game.button = (this.game.select_poker.index + this.game.firstSendIndex) % this.max;
        } else {
            this.game.firstSendIndex = this.game.button;
        }
        this.deal();
        this.game.gameSeats[this.game.button].peer = 1;

        const roomInfo = this.game.roomInfo;
        const seats = roomInfo.seats;
        let newSeats = [];

        if (this.game.lastResult.winType === WinType.default
            || this.game.lastResult.winType === WinType.doubel_buckle) {
            if (this.gameMod2 === 1) {
                this.changeSeats();
                if (!await this.rdb.updateRoomInfoSeats(this.roomId, seats)) {
                    return false;
                }
            } else {
                let realpeerIndex = (this.game.button + 2) % this.max;
                this.game.gameSeats[realpeerIndex].peer = 1;
            }
        } else {
            let realpeerIndex = (this.game.button + 2) % this.max;
            this.game.gameSeats[realpeerIndex].peer = 1;
        }
        for (let i = 0; i < seats.length; i++) {
            newSeats.push(seats[i].userId);
            this.roomMgr.setUserSeatIndex(seats[i].userId, i);
        }
        const beginData = {};
        beginData.select_poker = this.game.select_poker.value;
        beginData.newSeats = newSeats;
        beginData.numOfGames = this.game.roomInfo.numOfGames;
        beginData.button = this.game.button;
        beginData.raise = this.game.raise;
        beginData.firstSendIndex = this.game.firstSendIndex;//换位置前的座位号
        let clidata = {};
        clidata.users = [];
        for (let userId in this.dissolveInfo.users) {
            if (this.dissolveInfo.users.hasOwnProperty(userId)) {
                let u = this.dissolveInfo.users[userId];
                let user = {
                    userId: userId,
                    agree: u.agree
                };
                clidata.users.push(user);
            }
        }
        let tempTime = this.dissolveInfo.endTime - Date.now();
        clidata.time = tempTime < 0 ? -1 : tempTime * 0.001;
        beginData.dissolve = clidata;

        for (let i = 0; i < seats.length; i += 1) {
            beginData.holds = this.game.gameSeats[i].holds;
            let peerIndex = (i + 2) % this.max;
            beginData.pholds = this.game.gameSeats[peerIndex].holds;
            this.channelService.pushMessageByUids('gameDBuckleBegin', beginData, [{
                uid: seats[i].userId,
                sid: seats[i].fsid
            }], function (err) {
                if (err)
                    logger.error('gameDBuckleBegin:', err);
            });
        }
        this.game.lastChu.seatIndex = -1;
        this.game.lastChu.pattern = db_bk_Logic.PatternNone;
        this.game.lastChu.pai = [];
        this.game.oldChu.userId = 0;
        this.game.oldChu.seatIndex = -1;
        this.game.oldChu.pattern = db_bk_Logic.PatternNone;
        this.game.oldChu.pai = [];
        this.game.turn = this.game.button;
        this.recordGameAction(this.createBeginCmd());
        this.sendOperations(-1);
        return true;
    }

    changeSeats() {
        const countOccurences = (arr, value) => arr.reduce((a, v) => v === value ? a + 1 : a + 0, 0);
        let button_holds = this.game.gameSeats[this.game.button].holds;
        let button_Select_poker_Count = countOccurences(button_holds, this.game.select_poker.value);
        if (button_Select_poker_Count === 1) {
            let peerIndex = -1;
            for (let i = 0; i < this.game.gameSeats.length; i++) {
                if (i !== this.game.button) {
                    let holds = this.game.gameSeats[i].holds;
                    let select_poker_count = countOccurences(holds, this.game.select_poker.value);
                    if (select_poker_count === 1) {
                        peerIndex = i;
                        this.game.gameSeats[i].peer = 1;
                        break;
                    }
                }
            }
            if (peerIndex !== -1) {
                //把队友换到庄对面
                let realpeerIndex = (this.game.button + 2) % this.max;
                let tempExchangVal = this.game.gameSeats[realpeerIndex];
                this.game.gameSeats[realpeerIndex] = this.game.gameSeats[peerIndex];
                this.game.gameSeats[realpeerIndex].seatIndex = realpeerIndex;
                this.game.gameSeats[peerIndex] = tempExchangVal;
                this.game.gameSeats[peerIndex].seatIndex = peerIndex;
                //房间信息更换
                const roomInfo = this.game.roomInfo;
                const seats = roomInfo.seats;
                let tempSeatExchangVal = seats[realpeerIndex];
                seats[realpeerIndex] = seats[peerIndex];
                seats[peerIndex] = tempSeatExchangVal;
            } else {
                logger.error(`button_Select_poker_Count 找不到peer :${button_Select_poker_Count}`);
            }
        } else if (button_Select_poker_Count === 2) {
            let realpeerIndex = (this.game.button + 2) % this.max;
            this.game.gameSeats[realpeerIndex].peer = 1;
        } else {
            logger.error(`button_Select_poker_Count 计算错误 :${button_Select_poker_Count}`);
        }
    }

    chupai(userId, pokers, cb) {
        const seatData = this.gameSeatsOfUsers[userId];
        const seatIndex = seatData.seatIndex;
        if (!seatData) {
            logger.error(`${userId}  can't find user game data`);
            cb({code: gameRetCode.FAIL, msg: '没有你的座位信息'});
            return;
        }
        if (this.game.state !== this.gameState.playing) {
            logger.error(`${userId} func[chuPai]  this.game.state :${this.game.state}`);
            cb({code: gameRetCode.FAIL, msg: '游戏还没开始'});
            return;
        }
        if (this.game.turn !== seatData.seatIndex) {
            logger.error(`${userId} not your turn.`);
            cb({code: gameRetCode.FAIL, msg: '还没轮到你出牌'});
            return;
        }
        if (pokers.length <= 0) {
            logger.error(`${pokers} no pokers `);
            cb({code: gameRetCode.FAIL, msg: '你没有选牌'});
            return;
        }
        let tempHolds = com.deepCopyArr(seatData.holds);
        for (let i = 0; i < pokers.length; i++) {
            let index = tempHolds.indexOf(pokers[i]);
            if (index === -1) {
                logger.error(`${userId} holds:${seatData.holds} \n can't find poker.${pokers[i]}`);
                cb({code: gameRetCode.FAIL, msg: `你没有牌:${db_bk_Logic.printfCard(pokers[i])}`});
                return;
            }
            tempHolds.splice(index, 1);
        }
        let map = db_bk_Logic.getCardsMap(pokers);
        let sortPokers = db_bk_Logic.bubbleSort(pokers);
        let cardsType = db_bk_Logic.getCardsType({arr: sortPokers, map});
        if (!cardsType) {
            cb({code: gameRetCode.FAIL, msg: `牌型错误-1`});
            return;
        }
        if (this.game.oldChu.seatIndex === seatIndex || this.game.oldChu.seatIndex === -1) {

        } else {
            if (cardsType.pattern === this.game.oldChu.pattern) {
                let lastPai = this.game.oldChu.pai;
                let lsmap = db_bk_Logic.getCardsMap(lastPai);
                let lastcardsType = db_bk_Logic.getCardsType({arr: lastPai, map: lsmap});
                let lastBig = lastcardsType.big;
                if (cardsType.pattern == db_bk_Logic.PatternSinList ||
                    cardsType.pattern == db_bk_Logic.PatternDouList ||
                    cardsType.pattern == db_bk_Logic.PatternTriList ||
                    cardsType.pattern == db_bk_Logic.PatternTriList2) {
                    if (pokers.length !== this.game.oldChu.pai.length) {
                        cb({code: gameRetCode.FAIL, msg: '牌型错误-2'});
                        return;
                    }
                }
                if (cardsType.pattern == this.game.oldChu.pattern && this.game.oldChu.pattern == db_bk_Logic.PatternBomb) {
                    if (sortPokers.length < lastPai.length) {
                        cb({code: gameRetCode.FAIL, msg: '出的牌没有上家大,出牌失败-1'});
                        return;
                    } else if (sortPokers.length > lastPai.length) {
                        // logger.debug('炸弹张数大，出牌成功');
                    } else {
                        if (!db_bk_Logic.compareValue(cardsType.big, lastBig)) {
                            cb({code: gameRetCode.FAIL, msg: '出的牌没有上家大,出牌失败-2'});
                            return;
                        }
                    }
                } else {
                    if (!db_bk_Logic.compareValue(cardsType.big, lastBig)) {
                        cb({code: gameRetCode.FAIL, msg: '出的牌没有上家大,出牌失败-3'});
                        return;
                    }
                }
            } else {
                if (cardsType.pattern === db_bk_Logic.PatternBomb ||
                    cardsType.pattern === db_bk_Logic.PatternKingBomb) {
                    //天王炸只有一对
                    if (this.game.oldChu.pattern === db_bk_Logic.PatternKingBomb) {
                        cb({code: gameRetCode.FAIL, msg: '出的牌型错误或没有上家大,出牌失败-5'});
                        return;
                    }
                } else {
                    cb({code: gameRetCode.FAIL, msg: '出的牌型错误或没有上家大,出牌失败-4'});
                    return;
                }
            }
        }
        this.game.lastChu.seatIndex = seatIndex;
        this.game.lastChu.pai = sortPokers;
        this.game.lastChu.pattern = cardsType.pattern;
        this.game.oldChu.userId = userId;
        this.game.oldChu.seatIndex = seatIndex;
        this.game.oldChu.pai = sortPokers;
        this.game.oldChu.pattern = cardsType.pattern;
        this.channel.pushMessage('gameDBuckleChupai', {userId: seatData.userId, pai: pokers},
            function (err) {
                if (err)
                    logger.error('chupai', err);
            });
        seatData.holds = tempHolds;
        seatData.folds.push(...sortPokers);
        //出牌了 就把出完牌的人的状态改变下
        let endusers = this.game.endusers;
        for (let j = 0; j < endusers.length; j++) {
            let overUser = this.gameSeatsOfUsers[endusers[j]];
            if (overUser) {
                overUser.state = 1;
            }
        }
        if (seatData.holds.length <= 0) {
            this.game.endusers.push(userId);
        }
        cb({code: gameRetCode.OK, data: {userId: seatData.userId, pai: pokers}, msg: '出牌成功'});

        this.recordGameAction({
            cmd: 'chupai', vars: {
                userId: seatData.userId,
                pai: pokers
            }
        });

        if (this.checkOver()) {
            this.gameOver();
        } else {
            this.moveToNextUser(1);
        }
    }

    guo(userId, cb) {
        const seatData = this.gameSeatsOfUsers[userId];
        const seatIndex = seatData.seatIndex;
        if (!seatData) {
            logger.error(`${userId}  can't find user game data`);
            cb({code: gameRetCode.FAIL, msg: '没有你的座位信息'});
            return;
        }
        if (this.game.state !== this.gameState.playing) {
            logger.error(`${userId} func[chuPai]  this.game.state :${this.game.state}`);
            cb({code: gameRetCode.FAIL, msg: '游戏还没开始'});
            return;
        }
        if (this.game.turn !== seatData.seatIndex) {
            logger.error(`${userId} not your turn.`);
            cb({code: gameRetCode.FAIL, msg: '还没轮到你出牌'});
            return;
        }

        if (this.game.oldChu.seatIndex === seatData.seatIndex || this.game.oldChu.seatIndex === -1) {
            logger.error(`${userId}  must chu.`);
            cb({code: gameRetCode.FAIL, msg: '该轮必须得出牌'});
            return;
        }

        cb({code: gameRetCode.OK, data: {}, msg: '过,成功'});

        this.recordGameAction({
            cmd: 'guo', vars: {
                userId: seatData.userId,
            }
        });

        this.game.lastChu.seatIndex = seatIndex;
        this.game.lastChu.pai = [];
        this.game.lastChu.pattern = db_bk_Logic.PatternNone;

        this.moveToNextUser(0);
    }

    checkOver() {
        let endusers = this.game.endusers;
        if (endusers.length <= 1) {
            return false;
        }
        let gameSeatsOfUsers = this.gameSeatsOfUsers;
        if (gameSeatsOfUsers[endusers[0]].peer === gameSeatsOfUsers[endusers[1]].peer) {
            return true; //双扣了
        }
        if (endusers.length >= 3) {
            return true;//3个人都打完了
        }
    }

    gameOver() {
        let endusers = this.game.endusers;
        for (let i = 0; i < this.game.gameSeats.length; i++) {
            let seatData = this.game.gameSeats[i];
            let index = endusers.indexOf(seatData.userId);
            if (index === -1) {
                endusers.push(seatData.userId);
            }
        }
        let peer_overIndex = -1;
        let winSeat = this.gameSeatsOfUsers[endusers[0]];
        for (let i = 1; i < endusers.length; i++) {
            let seatData = this.gameSeatsOfUsers[endusers[i]];
            if (seatData.peer === winSeat.peer) {
                peer_overIndex = i;
            }
        }
        let winType = WinType.default;
        switch (peer_overIndex) {
            case 1:
                winType = WinType.doubel_buckle;
                break;
            case 2:
                winType = WinType.single_buckle;
                break;
            case 3:
                winType = WinType.self_buckle;
                break;
        }
        this.game.lastResult.winer.userId = endusers[0];
        this.game.lastResult.winer.peer = this.gameSeatsOfUsers[endusers[0]].peer;
        this.game.lastResult.winer.seatIndex = this.gameSeatsOfUsers[endusers[0]].seatIndex;
        this.game.lastResult.winType = winType;
        for (let i = 0; i < this.game.gameSeats.length; i++) {
            if (this.game.gameSeats[i].peer === this.game.lastResult.winer.peer) {
                if (winType === WinType.doubel_buckle) {
                    this.game.gameSeats[i].score = 4 * this.game.raise;
                } else if (winType === WinType.single_buckle) {
                    this.game.gameSeats[i].score = 2 * this.game.raise;
                } else if (winType === WinType.self_buckle) {
                    this.game.gameSeats[i].score = 1 * this.game.raise;
                }
            } else {
                if (winType === WinType.doubel_buckle) {
                    this.game.gameSeats[i].score = -4 * this.game.raise;
                } else if (winType === WinType.single_buckle) {
                    this.game.gameSeats[i].score = -2 * this.game.raise;
                } else if (winType === WinType.self_buckle) {
                    this.game.gameSeats[i].score = -1 * this.game.raise;
                }
            }
        }
        this.doGameOver(this.gameSeatsOfUsers[endusers[0]], false, winType);
    }

    async doGameOver(seatData, forceEnd, winType) {
        const winerId = seatData.userId;
        const roomId = this.roomMgr.getUserRoomId(winerId);
        if (roomId === null) {
            return;
        }
        const roomInfo = this.roomMgr.getRoom(roomId);
        if (roomInfo === null) {
            return;
        }
        let results = [];
        const dbresult = this.max === 2 ? [0, 0] : [0, 0, 0, 0];
        const fnNoticeResult = (isEnd) => {
            this.channel.pushMessage('gameOverDBuckleNotify', {results, isEnd: isEnd ? 1 : 0});
            // 如果局数已够，则进行整体结算，并关闭房间
            if (isEnd) {
                if (roomInfo.numOfGames > 0) {
                    // this.storeHistory();
                }
                if (roomInfo.numOfGames == 1) {
                    let creator = this.game.roomInfo.conf.creator;
                    this.rdb.incrWithholding(creator, codeConfig.GemType.GEM, -this.eachcost);
                }
                this.roomMgr.destroy(this.roomId, true, false);
            }
        };

        if (this.game !== null && roomInfo.numOfGames !== 0) {
            for (let i = 0; i < roomInfo.seats.length; i++) {
                const rs = roomInfo.seats[i];
                const sd = this.game.gameSeats[i];
                if (!sd) {
                    results = [];
                    break;
                }
                rs.ready = 0;
                rs.score += forceEnd ? 0 : parseInt(sd.score);
                const userRT = {
                    userId: sd.userId,
                    holds: sd.holds,
                    score: sd.score,
                    totalscore: rs.score,
                };
                userRT.win = !!(sd.peer === seatData.peer && winType !== WinType.default) ? 1 : 0;
                userRT.wintype = winType != null ? winType : WinType.default;
                results.push(userRT);

                dbresult[i] = sd.score;
                // delete this.gameSeatsOfUsers[sd.userId];
            }
            this.gameMgr.stopGame(roomId);
        } else {
            logger.error('doGameOver : game === null!');
        }

        this.recordGameAction({cmd: 'gameover', vars: {results}});

        //保存游戏
        this.game.actionRecord.push(this.game.actionList);

        const recordData = {};
        recordData.result = dbresult;
        recordData.create_time = com.timest(true);
        recordData.action_records = this.game.actionRecord;
        recordData.uuid = this.game.roomInfo.uuid;
        recordData.game_index = this.game.gameIndex;

        this.rdb.createGame(recordData);

        if (forceEnd) {
            fnNoticeResult(true);
        } else {

            // 保存游戏局数
            const updateRoomInfo = {};
            updateRoomInfo.num_of_games = roomInfo.numOfGames;
            for (let i = 0; i < roomInfo.seats.length; i++) {
                updateRoomInfo['seat_score_' + i] = roomInfo.seats[i].score;
            }
            if (this.game.lastResult.winType === WinType.doubel_buckle) {
                roomInfo.nextButton = -1;
                updateRoomInfo.next_button = -1;
            } else {
                roomInfo.nextButton = this.game.lastResult.winer.seatIndex;
                updateRoomInfo.next_button = this.game.lastResult.winer.seatIndex;
            }
            // 当前赢用户次数+1
            roomInfo.turnInfo[this.game.lastResult.winer.userId] += 1;
            const strJson = JSON.stringify(roomInfo.turnInfo);
            updateRoomInfo.turnInfo = strJson;

            updateRoomInfo['lastResult'] = JSON.stringify(this.game.lastResult);

            let isEnd = false;
            if (roomInfo.conf.gamenums > 0 && roomInfo.conf.gamenums <= roomInfo.numOfGames) {
                for (let i = 0; i < this.max; i++) {
                    const rs = roomInfo.seats[i];
                    const score = rs.score;
                    if (score !== 0) {
                        isEnd = true;
                        this.winnerCheck(roomInfo);
                    }
                }
            }
            // 更新房间信息
            let now = new Date();
            roomInfo.currentTime = now;
            updateRoomInfo.current_time = now;
            this.rdb.updateRoomInfo(roomId, updateRoomInfo);
            // 如果是第一次，并且不是强制解散 则扣除房卡
            if (roomInfo.numOfGames === 1) {
                if (this.roomtype === codeConfig.roomType.normal) {
                    let user = await this.mdb.get_user_data_by_userid(this.game.roomInfo.conf.creator);

                    if (user.gems > 0) {
                        user = await this.mdb.cost_gems(this.game.roomInfo.conf.creator, this.eachcost);
                        this.rdb.incrWithholding(this.game.roomInfo.conf.creator, codeConfig.GemType.GEM, -this.eachcost);
                    } else {
                        user = null;
                    }

                    if (user) {
                        let key = codeConfig.Statistics.cost.today;
                        if (this.max === 4) {
                            key += codeConfig.StatisticsGameType.dbuckle4_hz;
                        } else {
                            key += codeConfig.StatisticsGameType.dbuckle4_hz;
                        }
                        //这里改为统计局数
                        this.rdb.incrCostCount(key, codeConfig.GemType.GEM, 1);//this.eachcost
                    } else {
                        logger.error('房卡扣除失败');
                        isEnd = true;
                        // 房卡扣除失败，踢掉所有玩家
                        this.roomMgr.destroy(roomId);
                    }
                } else {
                    let key = codeConfig.Statistics.cost.today;
                    if (this.max === 4) {
                        key += codeConfig.StatisticsGameType.dbuckle4_hz;
                    } else {
                        key += codeConfig.StatisticsGameType.dbuckle4_hz;
                    }
                    //这里改为统计局数
                    this.rdb.incrCostCount(key, codeConfig.GemType.GEM, 1);//this.eachcost
                }
            }

            fnNoticeResult(isEnd);
        }
    }

    winnerCheck(roomInfo) {
        if (this._winnerChiken) return;
        this._winnerChiken = true;

        const dic = {};
        let max = null;
        for (let i = 0; i < this.max; i += 1) {
            const seat = roomInfo.seats[i];
            if (!dic[seat.score]) {
                dic[seat.score] = [];
            }
            dic[seat.score].push(seat.userId);

            if (max === null || seat.score >= max) {
                max = seat.score;
            }
        }

        if (this.roomtype === codeConfig.roomType.normal) {
            // 大赢家
            const list = dic[max];
            let clubId = this.game.conf.clubId;
            let gametype = codeConfig.StatisticsGameType.dbuckle4_hz;
            for (let i = 0; i < list.length; i += 1) {
                this.rdb.incrBigWinerCount(list[i], gametype);
                if (clubId !== '') {
                    this.rdb.incrClubBigWinerCount(list[i], clubId, gametype);
                }
            }
        }
    }

    moveToNextUser(opt) {
        let self = this;
        const next = function () {
            self.game.turn += 1;
            self.game.turn %= self.max;
            return self.game.gameSeats[self.game.turn];
        };
        let i = 0;
        while (i < this.max) {
            let endusers = self.game.endusers;
            let seatData = next();
            let resultIndex = endusers.indexOf(seatData.userId);
            if (resultIndex === -1) {
                self.sendOperations(opt);
                break;
            } else {
                if (resultIndex === endusers.length - 1) {
                    let overUser = self.gameSeatsOfUsers[endusers[resultIndex]];
                    if (overUser && overUser.state === 0) {
                        self.game.turn = (overUser.seatIndex + 2) % self.max;
                        overUser.state = 1;
                        this.game.lastChu.seatIndex = self.game.turn;
                        this.game.lastChu.pattern = db_bk_Logic.PatternNone;
                        this.game.lastChu.pai = [];
                        this.game.oldChu.userId = self.game.gameSeats[self.game.turn].userId;
                        this.game.oldChu.seatIndex = self.game.turn;
                        this.game.oldChu.pattern = db_bk_Logic.PatternNone;
                        this.game.oldChu.pai = [];
                        self.sendOperations(opt);
                        break;
                    }
                }
            }
            i++;
        }
    }

    sendOperations(opt) {
        this.channel.pushMessage('gameDBuckleAction', {
            turn: this.game.turn,
            lcSeatIndex: this.game.lastChu.seatIndex,
            lcOpt: opt //上一个操作者的操作类型 0:guo 1:chu
        });
    }

    sync(userId) {
        if (this.game.state === this.gameState.begin) {
            return false;
        }
        const seatData = this.gameSeatsOfUsers[userId];
        if (!seatData) {
            logger.error('sync: no user ', userId);
            return;
        }
        const roomInfo = this.game.roomInfo;
        const data = {
            state: this.game.state,
            turn: this.game.turn,
            lcSeatIndex: this.game.lastChu.seatIndex,
            numOfGames: roomInfo.numOfGames,
            roomId: roomInfo.id,
            oldChu: this.game.oldChu,
            raise: this.game.raise,
            endusers: this.game.endusers,
        };
        data.seats = [];
        for (let i = 0; i < this.max; i++) {
            const sd = this.game.gameSeats[i];
            const s = {
                userId: sd.userId,
                folds: sd.folds,
            };
            if (sd.userId === userId || sd.peer === seatData.peer) {
                s.holds = sd.holds;
            } else {
                s.holdslen = sd.holds.length;
            }
            data.seats.push(s);
        }
        this.channelService.pushMessageByUids('gameDBuckleSync',
            data, [{uid: seatData.userId, sid: seatData.fsid}], function (err) {
                if (err)
                    logger.error(err);
            });
    }

    createBeginCmd() {
        const roomInfo = this.game.roomInfo;
        this.game.actionRecord = [];
        this.game.actionList = [];
        let data = {};
        data.roomId = this.roomId;
        data.seats = [];
        for (let i = 0; i < this.game.gameSeats.length; i++) {
            let seat = {};
            let sd = this.game.gameSeats[i];
            seat.userId = sd.userId;
            seat.holds = com.deepCopyArr(sd.holds);
            let rs = roomInfo.seats[i];
            seat.score = rs.score;
            seat.name = rs.name;
            seat.headimg = rs.headimg;
            seat.sex = rs.sex;
            data.seats.push(seat);
        }
        data.button = this.game.button;
        data.conf = this.game.conf;
        data.cmd = 'begin';
        return data;
    }

    recordGameAction(cmd) {
        if (cmd instanceof Object) {
            let action = {};
            switch (cmd.cmd) {
                case 'begin':
                    this.game.actionRecord.push(cmd);
                    break;
                case 'chupai':
                    action.cmd = cmd.cmd;
                    action.userId = cmd.vars.userId;
                    action.pai = cmd.vars.pai;
                    this.game.actionList.push(action);
                    break;
                case "guo":
                    action.cmd = cmd.cmd;
                    action.userId = cmd.vars.userId;
                    this.game.actionList.push(action);
                    break;
                case 'gameover':
                    action.cmd = cmd.cmd;
                    action.results = cmd.vars.results;
                    this.game.actionRecord.push(action);
                    break;
            }
        } else {
            logger.error('recordGameAction error');
        }
    }

    async storeHistory() {
        const roomInfo = this.game.roomInfo;
        let clubId = this.game.conf.clubId;
        const seats = roomInfo.seats;
        const history = {
            uuid: roomInfo.uuid,
            id: roomInfo.id,
            time: com.timest(true),//roomInfo.createTime,
            conf: roomInfo.conf,
            seats: new Array(this.max),
        };
        let type = codeConfig.StatisticsGameType.dbuckle4_hz;
        for (let i = 0; i < seats.length; i++) {
            let sd = seats[i];
            let hs = {};
            hs.userid = sd.userId;
            hs.name = sd.name;
            hs.score = sd.score;
            history.seats[i] = hs;
            if (clubId !== '') {
                await this.rdb.incrClubBattleCount(sd.userId, clubId, type);
                await this.rdb.incrClubBattleMonCount(sd.userId, clubId, type);
            }
        }
        for (let i = 0; i < seats.length; i += 1) {
            const s = seats[i];
            await this.rdb.addHistory(s.userId, type, history);
        }
        if (clubId !== '') {
            await this.rdb.addClubHistory(clubId, type, history);
        }
    }

}


module.exports = Game;
