const fs = require('../lib/sync-fs');
const skipFn = require('../lib/skip-fn');
const warn = require('../lib/log').warn;
const info = require('../lib/log').info;
const pouch = require('../lib/db');
const warnUploadOverwrite = require('../lib/warn-upload-overwrite');
const request = require('request-promise-native');
const semver = require('semver');

const FILE_MATCHER = /messages-.*\.properties/;

module.exports = async (projectDir, couchUrl) => {
  if(!couchUrl) return skipFn('no couch URL set');

  const dir = `${projectDir}/translations`;
  const db = pouch(couchUrl);
  const instanceUrl = couchUrl.replace(/\/medic$/, '');

  if(!fs.exists(dir)) return warn('Could not find custom translations dir:', dir);

  const fileNames = fs.readdir(dir)
                      .filter(name => FILE_MATCHER.test(name));

  for (let fileName of fileNames) {
    const translations = propertiesAsObject(`${dir}/${fileName}`);

    let doc;
    try {
      doc = await db.get(idFor(fileName));
    } catch(e) {
      if (e.status === 404) {
        doc = await newDocFor(fileName, instanceUrl, db);
      }
      else throw e;
    }

    overwriteProperties(doc, translations);

    await warnUploadOverwrite.preUpload(projectDir, db, doc, couchUrl);

    info(`Uploaded translation ${dir}/${fileName} to ${couchUrl}/${doc._id}`);
    await db.put(doc);

    await warnUploadOverwrite.postUpload(projectDir, db, doc, couchUrl);
  }

  return Promise.resolve();
};

function propertiesAsObject(path) {
  const vals = {};
  fs.read(path)
    .split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split(/=(.*)/, 2).map(it => it.trim()))
    .map(([k, v]) => vals[k] = v);
  return vals;
}

function overwriteProperties(doc, props) {
  if(doc.generic) {
    // 3.4.0 translation structure
    doc.custom = props;
  } else if (doc.values) {
    // pre-3.4.0 doc structure
    for(const k in props) {
      if(props.hasOwnProperty(k)) {
        doc.values[k] = props[k];
      }
    }
  } else {
    throw new Error(`Existent translation doc ${doc._id} is malformed`);
  }

  return doc;
}

const newDocFor = async (fileName, instanceUrl, db, languageName, languageCode) => {

  const doc = {
    _id: idFor(fileName),
    type: 'translations',
    code: languageCode,
    name: languageName,
    enabled: true,
  };

  const useGenericTranslations = await genericTranslationsStructure(instanceUrl, db);
  if (useGenericTranslations) {
    doc.generic = {};
  } else {
    doc.values = {};
  }

  return doc;
};

function idFor(fileName) {
  return fileName.substring(0, fileName.length - 11);
}

const getVersion = (instanceUrl, db) => {
  return request({ uri: `${instanceUrl}/api/deploy-info`, method: 'GET', json: true }) // endpoint added in 3.5
    .catch(() => db.get('_design/medic-client').then(doc => doc.deploy_info)) // since 3.0.0
    .then(deploy_info => deploy_info && deploy_info.version);
};

const genericTranslationsStructure = async (instanceUrl, db) => {
  try {
    const version = await getVersion(instanceUrl, db);
    if (semver.valid(version)) {
      return semver.gte(version, '3.4.0');
    }

    const doc = await db.get('messages-en');
    return doc.generic;
  } catch(e) {
    return false;
  }
};
