const request = require('request-promise-native');
const inquirer = require('inquirer');
const jsonDiff = require('json-diff');
const fse = require('fs-extra');
const attachmentsFromDir = require('../lib/attachments-from-dir');
const attachmentFromFile = require('../lib/attachment-from-file');
const fs = require('../lib/sync-fs');
const info = require('../lib/log').info;
const insertOrReplace = require('../lib/insert-or-replace');
const skipFn = require('../lib/skip-fn');
const trace = require('../lib/log').trace;
const warn = require('../lib/log').warn;
const pouch = require('../lib/db');

const SUPPORTED_PROPERTIES = ['context', 'icon', 'internalId', 'title'];

const actionChoices = [
  { name: 'Overwrite the changes', value: 'overwrite' }, 
  { name: 'Abort so that you can update the form', value: 'abort' }
];

const actionQuestionsWithDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a form that has been modified since your last upload. Do you want to?',
  choices: actionChoices.concat([{ name: 'View diff', value: 'diff' }])
}];

const actionQuestionsWithoutDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a form that has been modified since your last upload. Do you want to?',
  choices: actionChoices
}];

module.exports = async (projectDir, couchUrl, subDirectory, options) => {
  if(!couchUrl) return skipFn('no couch URL set');

  const db = pouch(couchUrl);

  if(!options) options = {};

  const formsDir = `${projectDir}/forms/${subDirectory}`;


  if(!fs.exists(formsDir)) {
    warn(`Forms dir not found: ${formsDir}`);
    return Promise.resolve();
  }
  const fileNames = fs.readdir(formsDir)
    .filter(name => name.endsWith('.xml'))
    .filter(name => !options.forms || options.forms.includes(fs.withoutExtension(name)));

  try {
    await asyncForEach(fileNames, async (fileName) => {
      info(`Preparing form for upload: ${fileName}…`);

      const baseFileName = fs.withoutExtension(fileName);
      const mediaDir = `${formsDir}/${baseFileName}-media`;
      const xformPath = `${formsDir}/${baseFileName}.xml`;
      const baseDocId = (options.id_prefix || '') + baseFileName.replace(/-/g, ':');

      if(!fs.exists(mediaDir)) info(`No media directory found at ${mediaDir} for form ${xformPath}`);

      const xml = fs.read(xformPath);

      if(!formHasInstanceId(xml)) {
        throw new Error(`Form at ${xformPath} appears to be missing <meta><instanceID/></meta> node.  This form will not work on medic-webapp.`);
      }

      const internalId = readIdFrom(xml);
      if(internalId !== baseDocId) warn('DEPRECATED', 'Form:', fileName, 'Bad ID set in XML.  Expected:', baseDocId, 'but saw:', internalId, ' Support for setting these values differently will be dropped.  Please see https://github.com/medic/medic-webapp/issues/3342.');

      const docId = `form:${baseDocId}`;
      const doc = {
        _id: docId,
        type: 'form',
        internalId: internalId,
        title: readTitleFrom(xml),
        context: options.default_context,
      };

      const propertiesPath = `${formsDir}/${baseFileName}.properties.json`;
      updateFromPropertiesFile(doc, propertiesPath);

      doc._attachments = fs.exists(mediaDir) ? attachmentsFromDir(mediaDir) : {};
      doc._attachments.xml = attachmentFromFile(xformPath);

      const docUrl = `${couchUrl}/${docId}`;

      // Pull remote _rev
      let remoteRev = 'remoteRev';
      let remoteJson = '';
      try {
        const response = await request.get({
          method: 'GET',
          url: `${couchUrl}/${docId}`,
        });
        remoteJson = JSON.parse(response);
        remoteRev = remoteJson._rev;
      } catch (e) {
        // continue regardless of error
      }

      // Pull local _rev
      let localRev = 'localRev';
      try {
        localRev = fs.read(`${projectDir}/._revs/${docId}`);
      } catch (e) {
        // continue regardless of error
      }

      // Compare _revs
      // If _revs are different, show prompt
      if (localRev !== remoteRev) {
        let response = await inquirer.prompt(actionQuestionsWithDiff);
        if (response.action === 'diff') {
          // Show diff
          console.log(jsonDiff.diffString(remoteJson, doc));

          response = await inquirer.prompt(actionQuestionsWithoutDiff);
        }
        if (response.action === 'abort') {
          throw new Error('configuration modified');
        }
      }

      trace('Uploading form', `${formsDir}/${fileName}`, 'to', docUrl);
      await insertOrReplace(db, doc);
      info('Uploaded form', `${formsDir}/${fileName}`, 'to', docUrl);

      const response = await request.get({
        method: 'GET',
        url: `${couchUrl}/${docId}`,
      });
      remoteJson = JSON.parse(response);
      remoteRev = remoteJson._rev;   

      await fse.outputFile(`${projectDir}/._revs/${docId}`, remoteRev);
    });
  } catch(e) {
    throw e;
  }
};

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

// This isn't really how to parse XML, but we have fairly good control over the
// input and this code is working so far.  This may break with changes to the
// formatting of output from xls2xform.
const readTitleFrom = xml => xml.substring(xml.indexOf('<h:title>') + 9, xml.indexOf('</h:title>'));
const readIdFrom = xml =>
    xml.match(/<model>[^]*<\/model>/)[0]
       .match(/<instance>[^]*<\/instance>/)[0]
       .match(/id="([^"]*)"/)[1];

const updateFromPropertiesFile = (doc, path) => {
  if(fs.exists(path)) {
    const properties = fs.readJson(path);

    if(typeof properties.context !== 'undefined') doc.context = properties.context;
    doc.icon = properties.icon;
    if(properties.title) doc.title = properties.title;

    if(properties.internalId) {
      warn('DEPRECATED', path, 'Please do not manually set internalId in .properties.json for new projects.  Support for configuring this value will be dropped.  Please see https://github.com/medic/medic-webapp/issues/3342.');
      doc.internalId = properties.internalId;
    }

    const ignoredKeys = Object.keys(properties).filter(k => !SUPPORTED_PROPERTIES.includes(k));
    if(ignoredKeys.length) warn('Ignoring property keys', ignoredKeys, 'in', path);
  }
};

const formHasInstanceId = xml => xml.includes('<instanceID/>');
