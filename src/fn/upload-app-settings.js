const fs = require('../lib/sync-fs');
const request = require('request-promise-native');
const skipFn = require('../lib/skip-fn');

module.exports = async (projectDir, couchUrl) => {
  const body = fs.read(`${projectDir}/app_settings.json`);

  if(!couchUrl) return skipFn('no couch URL set');

  const serverUrl = couchUrl.slice(0, couchUrl.lastIndexOf('/'));
  await request.put({
      method: 'PUT',
      url: `${serverUrl}/api/v1/settings?replace=1`,
      headers: { 'Content-Type':'application/json' },
      body: body,
  });

  return Promise.resolve();
};
