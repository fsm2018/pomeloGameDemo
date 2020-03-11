var logger = require('pomelo-logger').getLogger('m-debug',__filename);

module.exports = function (app) {
    return new Filter(app);
};

var Filter = function (app) {
    this.app = app;
};

Filter.prototype.before = async function (msg, session, next) {
    let game = await this.app.gameMgr.getGameByUserID(session.uid);
    if (game)
        session.game = game;
    next();
};
Filter.prototype.after = function (err, msg, session, resp, next) {

    next(err);
};
