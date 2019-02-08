const child = require('child_process');
const modulepath = './index.js';

const unitid = 'http'

const params = {
  debug: 'on',
  loglevel: 1,
}

const system = {

}

const config = [
  {
    id: '1',
    url: "https://frm.intrahouse.ru/",
    type: "get",
    interval: 10,
    statusCode: 200,
    headers: "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)",
    headerCL: false,
    body: "username=admin&password=1234!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
  },
  {
    parentid: '2',
    dn: "LAMP1",
    parseType: "search",
    json: "data.value",
    regexp: "<div\\b[^>]*>(.*?)</div>",
    regexptest: "[a-z0-9]",
    valueTrue: '1',
    valueFalse: 'null',
    flag: "gm",
    rescount: 1,
    number: true,
    actions: [
      {
        act: "on",
        url: "http://localhost:2222",
        type: "post",
        statusCode: 200,
        headers: "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)",
        body: "1",
        headerCL: false,
        updatestate: true,
      }
    ],
  }
];

const config2 = [
  {
    id: '7',
    reqAuthHeaders: 'Content-Type: application/x-www-form-urlencoded\r\nAccept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)',
    reqAuthType: 'post',
    body: 'username=admin&password=1234',
    reqAuthEverytime: false,
    unit: 'http1',
    interval: 60,
    reqAuth: true,
    headers: 'Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)',
    reqAuthBody: 'username=dev&password=27YQ943LAA417&login=%D0%92%D1%85%D0%BE%D0%B4&redirect=.%2Findex.php%3Fsid%3Dad74213b2bcd8cfbd72808355fb4861a',
    reqAuthUrl: 'https://frm.intrahouse.ru/ucp.php',
    url: 'https://frm.intrahouse.ru/ucp.php?i=pm&folder=inbox',
    reqAuthInheritQuery: false,
    headerCL: false,
    reqAuthInheritCookies: true,
    type: 'get',
    statusCode: 200
  },
  {
    id: '8',
    unit: 'http1',
    parentid: '7',
    json: 'data.value',
    regexp: '(homa)',
    number: false,
    dn: 'LAMP_2_1',
    flag: 'gm',
    parseType: 'text',
    rescount: 1,
    valueFalse: 'null',
    regexptest: '[a-z0-9]',
    actions: [
      {
        act: 'on',
        url: 'http://localhost:8081',
        type: 'get',
        statusCode: 200,
        headers: 'Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\nUser-Agent: intraHouse (http-plugin)',
        body: 'username=admin&password=1234',
        headerCL: false,
        updatestate: false
      }
    ],
    valueTrue: '1'
  }
]

const ps = child.fork(modulepath, [unitid]);

ps.on('message', data => {
  if (data.type === 'get' && data.tablename === `system/${unitid}`) {
    ps.send({ type: 'get', system });
  }

  if (data.type === 'get' && data.tablename === `params/${unitid}`) {
    ps.send({ type: 'get', params });
  }

  if (data.type === 'get' && data.tablename === `config/${unitid}`) {
    ps.send({ type: 'get', config: config2 });
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

setTimeout(() => {
ps.send({ type: 'act', data: [ { dn: 'LAMP1', prop: 'on' } ] });
}, 1000)
