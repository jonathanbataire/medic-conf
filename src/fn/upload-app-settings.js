const fs = require('../lib/sync-fs');
const request = require('request-promise-native');
const skipFn = require('../lib/skip-fn');
const pouch = require('../lib/db');
const warnUploadOverwrite = require('../lib/warn-upload-overwrite');

module.exports = async (projectDir, couchUrl) => {
  const body = fs.read(`${projectDir}/app_settings.json`);

  if(!couchUrl) return skipFn('no couch URL set');

  const db = pouch(couchUrl);

  const doc = {
    _id: 'settings',
    settings: JSON.parse(body)
  };

  await warnUploadOverwrite.preUpload(projectDir, db, doc, couchUrl);

  const serverUrl = couchUrl.slice(0, couchUrl.lastIndexOf('/'));
  await request.put({
      method: 'PUT',
      url: `${serverUrl}/api/v1/settings?replace=1`,
      headers: { 'Content-Type':'application/json' },
      body: body,
  });

  await warnUploadOverwrite.postUpload(projectDir, db, doc, couchUrl);

  return Promise.resolve();
};
