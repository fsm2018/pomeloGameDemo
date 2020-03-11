const com = require('./com');

const shopList = {
  iap: [
        { id: 'iap_04', name: '鸿时房卡X5', count: 5, cost: 2500, code: '' },
        { id: 'iap_05', name: '鸿时房卡X10', count: 10, cost: 5000, code: '' },
        { id: 'iap_06', name: '鸿时房卡X20', count: 20, cost: 9800, code: '' },
  ],
  wxp: [
        { id: 'wxp_01', name: '鸿时房卡X1', count: 5, cost: 2500, code: '' },
        { id: 'wxp_02', name: '鸿时房卡X10', count: 10, cost: 5000, code: '' },
        { id: 'wxp_03', name: '鸿时房卡X30', count: 20, cost: 10000, code: '' },
  ],
  jsp: [
        { id: 'jsp_01', name: '鸿时房卡X300', count: 125, cost: 30000, code: '' },
        { id: 'jsp_02', name: '鸿时房卡X500', count: 250, cost: 50000, code: '' },
        { id: 'jsp_03', name: '鸿时房卡X1500', count: 900, cost: 150000, code: '' },
  ],
  vip: [
        { id: 'vip_01', name: '鸿时房卡X500', count: 50, cost: 15000, code: '' },
        { id: 'vip_02', name: '鸿时房卡X500', count: 120, cost: 30000, code: '' },
  ],
};
function createOrder() {
  const order = `${com.timest()}_${com.randChat(10)}`;
  return order;
}

function getShopList() {
  return shopList;
}

function getGoodByID(id) {
  const t = id.substr(0, 3);
  const list = shopList[t];
  if (list) {
    for (let i = 0; i < list.length; i += 1) {
      const good = list[i];
      if (good.id === id) {
        return com.deepCopy(good);
      }
    }
  } else {
    console.log(`getGoodByID Error id Type : ${t}`);
  }

  return null;
}

function getXMLNodeValue(nodeName, xml) {
  const tmp = xml.split(`<${nodeName}>`);
  const tmp2 = tmp[1].split(`</${nodeName}>`);
  const tmp3 = tmp2[0].split('[');
  const tmp4 = tmp3[2].split(']');
  return tmp4;
}

exports.createOrder = createOrder;
exports.getShopList = getShopList;
exports.getGoodByID = getGoodByID;
exports.getXMLNodeValue = getXMLNodeValue;
