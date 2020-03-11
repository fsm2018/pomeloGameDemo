const router = require('koa-router')();
const rdb = require('../../../db/redis_db');

router.get('/testcardsMJ', async ctx => {

    const cards = ctx.query.cards;
    console.log('testcards cards :' + JSON.stringify(cards));
    if (cards) {
        let data = {};
        data.cards = cards;
        let ret = await rdb.setTestCards(data,'MJ');
        if(ret){
            ctx.body = '麻将配牌成功';
        }
        else {
            ctx.body = '麻将配牌失败';
        }
    } else {
        let ret = await rdb.delTestCards('MJ');
        if(ret) {
            ctx.body = '清除麻将配牌成功';
        }else {
            ctx.body = '清除麻将配牌失败';
        }
    }
});

router.get('/testcardsDBuckle', async ctx => {

    const cards = ctx.query.cards;
    console.log('testcards cards :' + JSON.stringify(cards));
    if (cards) {
        let data = {};
        data.cards = cards;
        let ret = await rdb.setTestCards(data,'DBuckle');
        if(ret){
            ctx.body = '双扣配牌成功';
        }
        else {
            ctx.body = '双扣配牌失败';
        }
    } else {
        let ret = await rdb.delTestCards('DBuckle');
        if(ret) {
            ctx.body = '清除双扣配牌成功';
        }else {
            ctx.body = '清除双扣配牌失败';
        }
    }
});

module.exports = router;
