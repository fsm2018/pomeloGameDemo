const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const codeConfig = require('../../../../../shared/codeConfig');
const tasksModel = require('../../../domain/task/tasksModel');
const com = require('../../../util/com');
const http = require('../../../util/httpUtil');

const code = codeConfig.retCode;

module.exports = function (app) {
    return new Remote(app);
};

var Remote = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
};

Remote.prototype.buildTasks = async function (ip, userId, data, cb) {
    cb();
};

Remote.prototype.updateTasks = async function (ip, userId, data, cb) {
    cb();
};
