const request = require('request');
const Plugin = require('./lib/plugin');


const plugin = new Plugin();

function createFunction(value) {
  try {
    return new Function('data', `return ${value}`);
  } catch (e) {
    return e.message;
  }
}


function prepareChildren(value) {
  switch (value.parseType) {
    case 'json':
      return ({
        ...value,
        parse: createFunction(value.json),
      });
    case 'text':
      return ({
        ...value,
        parse: value.regexp !== '' ? new RegExp(value.regexp, value.flag) : null,
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

  const body = !(value.type === 'get' || value.type === 'head') ? value.body : null

  return { ...value, headers, body };
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

function req({ url, type, headers, body, statusCode, headerCL }) {
  return new Promise((resolve, reject) => {
    if ( headerCL && !(type === 'get' || type === 'head')) {
      headers['Content-Length'] = body.length;
    }
    request({ uri: url, method: type, headers, body }, function (error, response, body) {
      if (error === null && (statusCode ? response.statusCode === statusCode : true)) {
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
    if (typeof item.parse !== 'function') {
      return { dn: item.dn, err: item.parse };
    }
    const data = JSON.parse(text);
    const value = item.number ? Number(item.parse(data)) : item.parse(data);
    if (item.number && isNaN(value)) {
      return { dn: item.dn, err: 'Value is NaN!' };
    } else {
      return { dn: item.dn, value };
    }
  } catch (e) {
    return { dn: item.dn, err: e.message };
  }
}

function parserREGEXP(text, item) {
  try {
    if (item.parse === null) {
      const value = item.number ? Number(text) : text;
      if (item.number && isNaN(value)) {
        return { dn: item.dn, err: 'Value is NaN!' };
      } else {
        return { dn: item.dn, value };
      }
    } else {
      const regex = item.parse;
      const values = regex.exec(text);
      const value = item.number ? Number(values[item.rescount]) : values[item.rescount];
      regex.exec('');
      if (item.number && isNaN(value)) {
        return { dn: item.dn, err: 'Value is NaN!' };
      } else {
        return { dn: item.dn, value };
      }
    }
  } catch (e) {
    return { dn: item.dn, err: e.message };
  }
}

function task() {
  req(this)
    .then(res => parser(res, this.values))
    .then(values => plugin.setDeviceValue(values))
    .catch(e => plugin.setDeviceValue(this.values.map(item => ({ dn: item.dn, err: e.message }))));
}

function worker(item) {
  const _task = task.bind(item);
  setInterval(_task, item.interval * 1000);
  _task();
}

plugin.on('start', () => {
  prepareData(plugin.channels)
    .forEach(worker);
});
