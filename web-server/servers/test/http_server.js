const Koa = require('koa');
const static = require('koa-static');

const app = new Koa();
const onerror = require('koa-onerror');

const service = require('./routes/service');
const index = require('./routes/index');

let config = null;

onerror(app);

exports.start = function start(cfg) {
    config = cfg;
    app.listen(80);
    console.log('web-server is listening on 1096');
};

app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'X-Requested-With');
    ctx.set('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
    ctx.set('X-Powered-By', ' 3.2.1');
    // ctx.set('Content-Type', 'application/json;charset=utf-8');
    await next();
});

app.use(async (ctx, next) => {
    ctx.conf = config;
    await next();
});

// x-response-time
app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});

// logger
app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});

app.use(static(`${__dirname}/public`));

// route
app.use(service.routes(), service.allowedMethods());
app.use(index.routes(), index.allowedMethods());
