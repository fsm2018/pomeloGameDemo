const jwt = require('jsonwebtoken');
const configs = require('../../../shared/config/config');
const logger = require('pomelo-logger').getLogger('m-debug',__filename);

exports.getNewToken = (account, os, version) => jwt.sign({account, os, version}, configs.TOKEN_KEY, {expiresIn: '7d'});
exports.verify = (token,os) => {
    try {
        return jwt.verify(token, configs.TOKEN_KEY);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            logger.error('token TokenExpiredError');
            return false;
        }
        // logger.error('token verify err', err);
        return false;
    }
};

