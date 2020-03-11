const as = require('./http_server');
const rdb = require('../../db/redis_db');
// const configs = require('./utils/configs.js').getConf();

// rdb.init(configs.redis());
rdb.init({HOST: '127.0.0.1', PORT: 6379});
as.start();
