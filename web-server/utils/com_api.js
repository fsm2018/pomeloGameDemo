
function getClientIp(req) {
  return req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
}
exports.getClientIp = getClientIp;

function send(ctx, ret) {
  const str = JSON.stringify(ret);
  // console.log(`send : ${str}`);
  ctx.body = str;
}
exports.send = send;

function sendMsg(ctx, errcode, errmsg, ret) {
  let data = ret;
  if (!data) {
    data = {};
  }
  data.errcode = errcode;
  data.errmsg = errmsg;
  send(ctx, data);
}
exports.sendMsg = sendMsg;


exports.raw = (args) => {
  let keys = Object.keys(args);
  keys = keys.sort();
  const newArgs = {};
  keys.forEach((key) => {
    newArgs[key] = args[key];
  });
  let string = '';
  for (const k in newArgs) {
    string += `&${k}=${newArgs[k]}`;
  }
  string = string.substr(1);
  return string;
};

