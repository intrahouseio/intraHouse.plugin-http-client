const request = require('request');
const Plugin = require('./lib/plugin');


const plugin = new Plugin();

const channels = [
  {
    id: '1',
    url: 'https://www.starline-online.ru/device?tz=180&_=1541691301544',
    type: 'get',
    interval: 2,
    statusCode: 200,
    headers: `
    accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8
    accept-language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
    cache-control: max-age=0
    cookie: _ym_uid=1541054542723769577; _ym_d=1541054542; __utmc=219212379; __utmz=219212379.1541576232.2.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); _ym_visorc_20868619=w; _ym_isad=2; __utma=219212379.1086144741.1541054542.1541576232.1541691296.3; __utmt=1; PHPSESSID=472ej88nuj7vdn6ia1aocipmf4; browser_timezone=3; uechat_34028_first_time=1541691298730; uechat_34028_disabled=true; uechat_34028_pages_count=2; __utmb=219212379.3.10.1541691296; lang=ru
    upgrade-insecure-requests: 1
    user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36
    `,
    body: '',
  },
  { id: '2', parentid: '1', dn: 'lamp1', parseType: 'json', json: 'data.answer.devices[2].car_state', number: false },
  { id: '3', parentid: '1', dn: 'lamp2', parseType: 'text', regexp: 'Всего.сообщений\: <strong>(.*?)<\/strong>', flag: 'gm', rescount: 1, number: true  },
];

function prepareChildren(value) {
  switch (value.parseType) {
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

function prepareParent(value) {
  const headers = value.headers
    .split(/\r?\n/)
    .reduce((l, n) => {
      const temp = n.split(':');
      if (temp.length == 2) {
        return {
          ...l,
          [temp[0].replace(/\s/g, '')]: temp[1]
        }
      }
      return l;
    },{});

  return { ...value, headers };
}

function prepareData(data) {
  const parent = []
  const children = {}

  data
    .forEach(i => {
      if (i.parentid === undefined || i.parentid === false) {
        parent.push(prepareParent(i));
      } else {
        if (children[i.parentid] === undefined) {
          children[i.parentid] = [];
        }
        children[i.parentid].push(prepareChildren(i));
      }
    });

  return parent.map(i => ({ ...i, values: children[i.id] }));
}

function req({ url, type, headers, statusCode }) {
  return new Promise((resolve, reject) => {
    request({ uri: url, method: type, headers }, function (error, response, body) {
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
    .map(value => value.parseType === 'json' ? parserJSON(text, value) : parserREGEXP(text, value));
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
  req(this)
    .then(res => parser(res, this.values))
    .then(values => plugin.debug(values))
    .catch(e => console.log(e.message));
}

function worker(item) {
  setInterval(task.bind(item), item.interval * 1000)
}

plugin.on('start', () => {
  prepareData(channels)
    .forEach(worker);
});
