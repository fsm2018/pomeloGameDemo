const xml = require('../utils/xmltools');

module.exports = () => async (ctx, next) => {
  if (ctx.method === 'POST' && ctx.is('text/xml')) {
    const promise = new Promise((resolve, reject) => {
      let buf = '';
      ctx.req.setEncoding('utf8');
      ctx.req.on('data', (chunk) => {
        buf += chunk;
      });
      ctx.req.on('end', () => {
        xml.xmlToJson(buf).then(resolve).catch(reject);
      });
    });

    await promise.then((result) => {
      ctx.req.xml = result;
    }).catch((e) => {
      e.status = 400;
    });

    await next();
  } else {
    await next();
  }
};
