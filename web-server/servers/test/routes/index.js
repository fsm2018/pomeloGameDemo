const router = require('koa-router')();
const mdb = require('../../../db/mongoose_db');
const rdb = require('../../../db/redis_db');
const comAPI = require('../../../utils/com_api');
const com = require('../../../utils/com');
const fs = require('fs');
const path = require('path');
const watchUtils = require('../../../utils/watchUtils');

let ServerStateInfo = "";
(function () {
    let p = path.join(__dirname, "../../../../shared/config/ServerStateInfo.json");
    ServerStateInfo = JSON.parse(fs.readFileSync(p, 'utf8'))['production'];
    watchUtils.watchFile(p, function () {
        fs.readFile(p, 'utf8', function (err, data) {
            if (!err) {
                try {
                    ServerStateInfo = JSON.parse(fs.readFileSync(p, 'utf8'))['production'];
                } catch (e) {
                    console.error(`set ServerStateInfo fail:${e}`);
                }
            } else {
                console.error(`readFile ServerStateInfo fail:${err}`);
            }
        });
    });

})();


router.get('/getServerStateInfo', async (ctx) => {
    // let p = path.join(__dirname, "../../../../shared/config/ServerStateInfo.json");
    // ctx.body = JSON.parse(fs.readFileSync(p, 'utf8'))['production'];
    ctx.body = ServerStateInfo;
});

module.exports = router;