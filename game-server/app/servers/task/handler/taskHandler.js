const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
const tasksModel = require('../../../domain/task/tasksModel');
const httpUtil = require('../../../util/httpUtil');
const com = require('../../../util/com');
const smsMgr = require('../../../util/smsMgr');

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
    this.sendsms = false;
};

Handler.prototype.getTasks = async function (msg, session, next) {
    next(null, {code: code.OK, data: {}});
};

Handler.prototype.finishTask = async function (msg, session, next) {

        next(null, {code: code.FAIL, msg: ''});
};
