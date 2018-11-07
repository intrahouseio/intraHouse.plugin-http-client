const request = require('request');
const Plugin = require('./lib/plugin');


const plugin = new Plugin();

const channels = [
  { url: 'https://frm.intrahouse.ru/', interval: 2, values: [{ dn: 'lamp1', parse: 'data.a' }, { dn: 'lamp2', parse: 'data.b.b' }], statusCode: 200, json: true }
];

function req(url, statusCode) {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, body) {
      if (error === null && (statusCode && response.statusCode === statusCode)) {
        resolve('{ "a": 1, "b": 2 }');
      } else {
        reject(error || Error(`Response status code no match: ${response.statusCode}`));
      }
    });
  });
}

function parserJSON(text, values) {
  const data = JSON.parse(text);
  return values
    .map(item => ({ dn: item.dn, res: item.parse(data) }));
}

function parserREGEXP(text) {
  return text;
}

function task(item) {
  req(this.url, this.statusCode)
    .then(res => this.json ? parserJSON(res, this.values) : parserREGEXP(res, this.values))
    .then(values => console.log(values))
    .catch(e => console.log(e.message));
}

function worker(item) {
  const values = item.json ?
    item.values
      .map(i => ({
        dn: i.dn,
        parse: new Function('data', `try { return { value: ${i.parse}, status: 1 } } catch (e) { return { error: e.message, status: 0 } }`)
      }))
    :
    item.values;
  setInterval(task.bind({ ...item, values }) ,item.interval * 1000)
}

plugin.on('start', () => {
  channels.forEach(worker);
});
