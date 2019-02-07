const request = require('request');
const Plugin = require('./lib/plugin');

const plugin = new Plugin();

const STORE = {};

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
    case 'search':
      return ({
        ...value,
        parse: value.regexp !== '' ? new RegExp(value.regexptest, value.flag) : null,
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

function prepareTasks(data) {
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

  return parent.map(i => ({ ...i, values: children[i.id] || [] }));
}

function prepareActions(data) {
  const actions = {};
  data
    .forEach((r, key) => {
      r.values.forEach(c => {
        if (c.actions) {
          actions[c.dn] = {};
            c.actions.forEach(a => {
              a.task = key;
              actions[c.dn][a.act] = prepareParent(a);
            });
        }
      });
    });
  return actions;
}

function req({ url, type, headers, body, statusCode, headerCL }) {
  return new Promise((resolve, reject) => {
    if ( headerCL && !(type === 'get' || type === 'head')) {
      headers['Content-Length'] = body.length;
    }
    request({ uri: url, method: type, headers, body }, function (error, response, body) {
      if (error === null && (statusCode ? response.statusCode === statusCode : true)) {
        plugin.debug(`${type.toUpperCase()} ${url}\n---- HEADERS START ----\n${JSON.stringify(response.headers, null, 2)}\n---- HEADERS END ----\n---- BODY START ----\n${body}---- BODY END ----\n\n`, 1);
        resolve(body);
      } else {
        const error_text = error ? error.message : `Response status code no match, ${statusCode} != ${response.statusCode}`;
        plugin.debug(`${type.toUpperCase()} ${url}  error: ${error_text}`, 1);
        reject(error || Error(`Response status code no match, ${statusCode} != ${response.statusCode}`));
      }
    });
  });
}

function parser(text, values) {
  return values
    .map(value => {
      switch (value.parseType) {
        case 'json':
          return parserJSON(text, value);
        case 'text':
          return parserREGEXP(text, value);
        case 'search':
           return parserREGEXPTEST(text, value);
        default:
          return {};
      }
    })
    .filter(i => i.dn !== null);
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

function parserREGEXPTEST(text, item) {
  try {
      const regex = item.parse;
      const test = regex.test(text);
      regex.test('');
      if (test) {
        return { dn: item.dn, value: item.number ? Number(item.valueTrue) : item.valueTrue };
      } else {
        if (item.valueFalse !== 'null') {
          return { dn: item.dn, value: item.number ? Number(item.valueFalse) : item.valueFalse };
        } else {
          return { dn: null };
        }
      }
  } catch (e) {
    return { dn: item.dn, err: e.message };
  }
}

function task() {
  req(this)
    .then(res => parser(res, this.values))
    .then(values => {
      if (values.length) {
        plugin.setDeviceValue(values);
      }
    })
    .catch(e => plugin.setDeviceValue(this.values.map(item => ({ dn: item.dn, err: e.message }))));
}

function worker(item) {
  const _task = task.bind(item);
  setInterval(_task, item.interval * 1000);
  _task();
}

plugin.on('device_action', (device) => {
  if (STORE.actions[device.dn] && STORE.actions[device.dn][device.prop]) {
    const action = STORE.actions[device.dn][device.prop];

    req(action)
      .then(res => {
        if (action.updatestate) {
          task.bind(STORE.tasks[action.task]).call();
        } else {
          plugin.setDeviceValue([{ dn: device.dn, value: device.prop === 'on' ? 1 : 0 }]);
        }
      })
      .catch(e => plugin.setDeviceValue([{ dn: device.dn, err: e.message }]));
  }
});

plugin.on('start', () => {
  STORE.tasks = prepareTasks(plugin.channels);
  STORE.actions = prepareActions(STORE.tasks);
  STORE.tasks.forEach(worker);
});
