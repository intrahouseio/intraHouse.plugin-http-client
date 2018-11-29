const child = require('child_process');
const modulepath = './index.js';

const unitid = 'http'

const params = {

}

const system = {

}

const config = [
  {
    id: '1',
    url: "http://localhost:2222",
    type: "post",
    interval: 60,
    statusCode: 200,
    headers: "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)",
    headerCL: false,
    body: "username=admin&password=1234!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
  },
  {
    parentid: '1',
    dn: "",
    parseType: "json",
    json: "data.value",
    regexp: "<div\\b[^>]*>(.*?)</div>",
    flag: "gm",
    rescount: 1,
    number: true
  }
];

const ps = child.fork(modulepath, [unitid]);

ps.on('message', data => {
  if (data.type === 'get' && data.tablename === `system/${unitid}`) {
    ps.send({ type: 'get', system });
  }

  if (data.type === 'get' && data.tablename === `params/${unitid}`) {
    ps.send({ type: 'get', params });
  }

  if (data.type === 'get' && data.tablename === `config/${unitid}`) {
    ps.send({ type: 'get', config });
  }

  if (data.type === 'data') {
    console.log('-------------data-------------', new Date().toLocaleString());
    console.log(data.data);
    console.log('');
  }

  if (data.type === 'channels') {
    console.log('-----------channels-----------', new Date().toLocaleString());
    console.log(data.data);
    console.log('');
  }

  if (data.type === 'debug') {
    console.log('-------------debug------------', new Date().toLocaleString());
    console.log(data.txt);
    console.log('');
  }
});

ps.on('close', code => {
  console.log('close');
});

ps.send({type: 'debug', mode: true });
