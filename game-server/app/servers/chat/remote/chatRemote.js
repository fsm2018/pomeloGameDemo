module.exports = function (app) {
    return new Remote(app);
};
var Remote = function (app) {
    this.app = app;
    this.channelService = app.get('channelService');
    this.channelUtil = app.get('channelUtil');
};

Remote.prototype.addRoom = function (uid, fsid, roomId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getRoomChannelName(roomId), true);
    this.channelUtil.addmember(channel, uid, fsid);
    cb();
};

Remote.prototype.leaveRoom = function (uid, roomId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getRoomChannelName(roomId));
    this.channelUtil.leaveChannel(channel, uid);
    cb();
};
Remote.prototype.destroyRoomChannel = function (roomId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getRoomChannelName(roomId));
    if (channel) {
        channel.destroy();
    }
    cb();
};
Remote.prototype.addClub = function (uid, fsid, clubId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getClubChannelName(clubId), true);
    this.channelUtil.addmember(channel, uid, fsid);
    cb();
};

Remote.prototype.leaveClub = function (uid, clubId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getClubChannelName(clubId));
    this.channelUtil.leaveChannel(channel, uid);
    cb();
};
Remote.prototype.destroyClubChannel = function (clubId, cb) {
    let channel = this.channelService.getChannel(this.app.get('channelUtil').getClubChannelName(clubId));
    if (channel) {
        channel.destroy();
    }
    cb();
};
