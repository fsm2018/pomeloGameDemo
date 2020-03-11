const logger = require('pomelo-logger').getLogger('m-debug', __filename);

var ChannelUtil = module.exports;

var GLOBAL_CHANNEL_NAME = 'global';
var ROOM_CHANNEL_NAME = 'room';
var CLUB_CHANNEL_NAME = 'club';
var HALLGAMEHALL_CHANNEL_NAME = 'hallgamehall';

ChannelUtil.getGlobalChannelName = function () {
    return GLOBAL_CHANNEL_NAME;
};

ChannelUtil.getRoomChannelName = function (roomId) {
    return ROOM_CHANNEL_NAME + roomId;
};

ChannelUtil.getClubChannelName = function (clubId) {
    return CLUB_CHANNEL_NAME + clubId;
};
ChannelUtil.getHallGameHallChannelName = function (hallId) {
    return HALLGAMEHALL_CHANNEL_NAME + hallId;
};

ChannelUtil.addmember = function (channel, uid, fsid) {
    if (!channel) {
        // logger.error(`ChannelUtil.addmember channel:${channel}`);
        return;
    }
    this.leaveChannel(channel, uid);
    let r = channel.add(uid, fsid);
    if (!r) {
        logger.error(`ChannelUtil.addmember ${r},uid:${uid},fsid:${fsid}`);
    }
};

ChannelUtil.leaveChannel = function (channel, uid) {
    if (!channel) {
        // logger.error(`ChannelUtil.leaveChannel channel:${channel}`);
        return;
    }
    let me = channel.getMember(uid);
    if (me) {
        let ret = channel.leave(uid, me.sid);
        if (!ret) {
            logger.error(`ChannelUtil.leaveChannel ${ret},uid:${uid},fsid:${me.sid}`);
        }
    }
};
