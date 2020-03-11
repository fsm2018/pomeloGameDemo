const com = require('../../../util/com');
module.exports = function (app) {
    return new Remote(app);
};

var Remote = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
};

