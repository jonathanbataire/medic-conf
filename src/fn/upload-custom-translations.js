const fs = require('../lib/sync-fs');
const skipFn = require('../lib/skip-fn');
const warn = require('../lib/log').warn;
const info = require('../lib/log').info;
const pouch = require('../lib/db');
const warnUploadOverwrite = require('../lib/warn-upload-overwrite');
const semver = require('semver');

const FILE_MATCHER = /messages-.*\.properties/;

module.exports = async (projectDir, couchUrl) => {
  if(!couchUrl) return skipFn('no couch URL set');

  const dir = `${projectDir}/translations`;
  const db = pouch(couchUrl);
  const instanceUrl = couchUrl.replace(/\/medic$/, '');

  return Promise.resolve()
    .then(() => {
      if(!fs.exists(dir)) return warn('Could not find custom translations dir:', dir);

      return Promise.all(fs.readdir(dir)
        .filter(name => FILE_MATCHER.test(name))
        .map(fileName => {
          const id = idFor(fileName);
          const languageCode = id.substring('messages-'.length);
          let languageName = ISO639.getName(languageCode);
          if (!languageName){
            warn(`'${languageCode}' is not a recognized ISO 639 language code, please ask admin to set the name`);
            languageName = 'TODO: please ask admin to set this in settings UI';
          } else {
            let languageNativeName = ISO639.getNativeName(languageCode);
            if (languageNativeName !== languageName){
              languageName = `${languageNativeName} (${languageName})`;
            }
          }

          var translations = propertiesAsObject(`${dir}/${fileName}`);

          return db.get(id)
            .catch(e => {
              if(e.status === 404) return newDocFor(fileName, instanceUrl, db, languageName, languageCode);
              else throw e;
            })
            .then(async (doc) => {
                   await warnUploadOverwrite.preUpload(projectDir, db, doc, couchUrl);
                   overwriteProperties(doc, translations);
                  await warnUploadOverwrite.postUpload(projectDir, db, doc, couchUrl);
                  return doc;
            })
            .then(doc => db.put(doc));
        }));
    });
  } catch(e) {
    throw e;
  }
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

function newDocFor(fileName, instanceUrl, db, languageName, languageCode) {

  const doc = {
    _id: idFor(fileName),
    type: 'translations',
    code: languageCode,
    name: languageName,
    enabled: true,
  };

  return genericTranslationsStructure(instanceUrl, db).then(useGenericTranslations => {
    if (useGenericTranslations) {
      doc.generic = {};
    } else {
      doc.values = {};
    }

    return doc;
  });
}

function idFor(fileName) {
  return fileName.substring(0, fileName.length - 11);
}

const getVersion = (instanceUrl, db) => {
  return request({ uri: `${instanceUrl}/api/deploy-info`, method: 'GET', json: true }) // endpoint added in 3.5
    .catch(() => db.get('_design/medic-client').then(doc => doc.deploy_info)) // since 3.0.0
    .then(deploy_info => deploy_info && deploy_info.version);
};

const genericTranslationsStructure = (instanceUrl, db) => {
  return getVersion(instanceUrl, db).then(version => {
    if (semver.valid(version)) {
      return semver.gte(version, '3.4.0');
    }

    return db
      .get('messages-en')
      .then(doc => doc.generic)
      .catch(() => false);
  });
};
