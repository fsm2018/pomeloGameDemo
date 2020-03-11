const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
const com = require('../../../util/com');


const code = codeConfig.retCode;

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
    this.channelService = app.get('channelService');
    this.statusService = app.get('statusService');
};

Handler.prototype.chatInGame = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let data = {};
    data.scene = msg.scene;
    data.sender = uid;
    if (com.isNumber(msg.type))
        data.type = msg.type;
    else
        data.type = 0;
    if (msg.content)
        data.content = msg.content;
    if (msg.desIndex != null)
        data.desIndex = msg.desIndex;
    if (msg.vtime)
        data.vtime = msg.vtime;
    if (msg.time)
        data.time = msg.time;
    else
        data.time = com.timest(true);
    if (msg.receiver)
        data.receiver = msg.receiver;

    let roomId = session.get('roomId');
    if (!roomId)
        roomId = session.get('hallgameId');
    if (roomId)
        data.roomId = roomId;
    let clubId = session.get('clubId');
    if (clubId)
        data.clubId = clubId;

    let channelname;
    let channel;
    if (data.scene == 1) { //游戏内消息
        if (!roomId) {
            next(null, {code: code.FAIL, msg: '你不在房间无法聊天'});
        }
        channelname = this.channelUtil.getRoomChannelName(roomId);
        channel = this.channelService.getChannel(channelname);
    } else if (data.scene == 2) { //俱乐部消息
        if (!clubId) {
            next(null, {code: code.FAIL, msg: '你不在牌友圈无法聊天'});
        }
        channelname = this.channelUtil.getClubChannelName(clubId);
        channel = this.channelService.getChannel(channelname);
    } else if (data.scene == 3) { //1v1消息
        if (uid == data.receiver) {
            next(null, {code: code.FAIL, msg: '不能给自己发送消息'});
            return;
        }
        this.statusService.getSidsByUid(data.receiver, async function (err, list) {
            if (err) {
                next(null, {code: code.FAIL, msg: '请重试'});
            } else {
                self.channelService.pushMessageByUids('chatInGame', data,
                    [{uid, sid: session.frontendId}],
                    function () {
                    });
                if (list.length > 0) {
                    self.channelService.pushMessageByUids('chatInGame', data,
                        [{uid: data.receiver, sid: list[0]}],
                        function () {
                        });
                } else {
                    await self.rdb.addPersonChatHistory(data.receiver, JSON.stringify(data));
                }
                next(null, {code: code.OK, data: {}});
            }
        });
        return;
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    if (channel) {
        channel.pushMessage('chatInGame', data, function (err) {
            if (err)
                logger.error('chatInGame', err);
        });
        next(null, {code: code.OK, data: {}});
        if (data.scene == 2) {
            await this.rdb.checkAndDelClubChatHistory(clubId);
            await this.rdb.addClubChatHistory(clubId, JSON.stringify(data));
        }
    } else {
        next(null, {code: code.FAIL, msg: '请重新登录并重试'});
    }
};

Handler.prototype.getChatHistory = async function (msg, session, next) {
    let uid = session.uid;
    let scene = msg.scene;
    let start = msg.start || 0;
    let step = msg.step;
    let end = -1;
    if (step) {
        end = start + step;
    }
    if (scene == 2) {
        let clubId = msg.clubId;
        if (!clubId) {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        let clubBaseInfo = await this.mdb.get_clubs_baseInfo_by_clubids([clubId]);
        if (clubBaseInfo[0].ownerid != uid && clubBaseInfo[0].members.indexOf(uid) == -1) {
            next(null, {code: code.FAIL, msg: '不是该圈子成员'});
            return;
        }
        let data = await this.rdb.getClubChatHistory(clubId, start, end);
        if (data) {
            next(null, {code: code.OK, data});
        } else {
            next(null, {code: code.FAIL, msg: '获取失败'});
        }
    } else if (scene == 3) {
        let data = await this.rdb.getPersonChatHistory(uid, start, end);
        next(null, {code: code.OK, data});
        this.rdb.delPersonChatHistory(uid);
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};
