const request = require('request');
const Plugin = require('./lib/plugin');


const plugin = new Plugin();

const channels = [
  { url: 'https://frm.intrahouse.ru/', interval: 2, values: [], statusCode: 200, json: false }
];

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

function parserJSON(text) {
  const json = JSON.parse(text);
  return json;
}

function parserREGEXP(text) {
  return text;
}

function task(item) {
  req(this.url, this.statusCode)
    .then(res => this.json ? parserJSON(res) : parserREGEXP(res))
    .then(values => console.log(values))
    .catch(e => console.log(e.message));
}

function worker(item) {
  setInterval(task.bind(item) ,item.interval * 1000)
}

plugin.on('start', () => {
  channels.forEach(worker);
});
