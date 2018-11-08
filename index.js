const request = require('request');
const Plugin = require('./lib/plugin');


const plugin = new Plugin();

const channels = [
  {
    id: '1',
    url: 'https://frm.intrahouse.ru/',
    type: 'get',
    interval: 2,
    statusCode: 200,
  },
  { id: '2', parentid: '1', dn: 'lamp1', type: 'json', json: 'data.a', number: true },
  { id: '3', parentid: '1', dn: 'lamp2', type: 'text', regexp: 'Всего.сообщений\: <strong>(.*?)<\/strong>', flag: 'gm', rescount: 1, number: true  },
];

function prepareValue(value) {
  switch (value.type) {
    case 'json':
      return ({
        ...value,
        parse: new Function('data', `return ${value.json}`),
      });
    case 'text':
      return ({
        ...value,
        parse: new RegExp(value.regexp, value.flag),
      });
    default:
      return value;
  }
  return value;
}

function prepareData(data) {
  const parent = []
  const children = {}

  data
    .forEach(i => {
      if (i.parentid === undefined) {
        parent.push(i);
      } else {
        if (children[i.parentid] === undefined) {
          children[i.parentid] = [];
        }
        children[i.parentid].push(prepareValue(i));
      }
    });

  return parent.map(i => ({ ...i, values: children[i.id] }));
}

function req(url, statusCode) {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, body) {
      if (error === null && (statusCode && response.statusCode === statusCode)) {
        resolve(body);
      } else {
        reject(error || Error(`Response status code no match: ${response.statusCode}`));
      }
    });
  });
}

function parser(text, values) {
  return values
    .map(value => value.type === 'json' ? parserJSON(text, value) : parserREGEXP(text, value));
}

function parserJSON(text, item) {
  try {
    const data = JSON.parse(text);
    return { dn: item.dn, value: item.number ? Number(item.parse(data)) : item.parse(data) };
  } catch (e) {
    return { dn: item.dn, error: e.message };
  }
}

function parserREGEXP(text, item) {
  try {
    const regex = item.parse;
    const values = regex.exec(text);
    regex.exec('');
    return { dn: item.dn, value: item.number ? Number(values[item.rescount]) : values[item.rescount] };
  } catch (e) {
    return { dn: item.dn, error: e.message };
  }
}

function task() {
  req(this.url, this.statusCode)
    .then(res => parser(res, this.values))
    .then(values => console.log(values))
    .catch(e => console.log(e.message));
}

function worker(item) {
  setInterval(task.bind(item), item.interval * 1000)
}

plugin.on('start', () => {
  prepareData(channels)
    .forEach(worker);
});
