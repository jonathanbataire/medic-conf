const fs = require('../lib/sync-fs');
const skipFn = require('../lib/skip-fn');
const warn = require('../lib/log').warn;
const pouch = require('../lib/db');
const warnUploadOverwrite = require('../lib/warn-upload-overwrite');

const attachmentsFromDir = require('../lib/attachments-from-dir');
const insertOrReplace = require('../lib/insert-or-replace');

module.exports = async (projectDir, couchUrl) => {
  if(!couchUrl) return skipFn('no couch URL set');

  const db = pouch(couchUrl);

  const resourcesPath = fs.path.resolve(`${projectDir}/resources.json`);

  if(!fs.exists(resourcesPath)) {
    warn(`No resources file found at path: ${resourcesPath}`);
    return Promise.resolve();
  }

  const doc = {
    _id: 'resources',
    resources: fs.readJson(resourcesPath),
    _attachments: attachmentsFromDir(`${projectDir}/resources`),
  };

  await warnUploadOverwrite.preUpload(projectDir, db, doc, couchUrl);

  await insertOrReplace(db, doc);

  await warnUploadOverwrite.postUpload(projectDir, db, doc, couchUrl);

  return Promise.resolve();
};
