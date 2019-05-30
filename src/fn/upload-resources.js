const fs = require('../lib/sync-fs');
const skipFn = require('../lib/skip-fn');
const warn = require('../lib/log').warn;
const pouch = require('../lib/db');
const request = require('request-promise-native');
const inquirer = require('inquirer');
const jsonDiff = require('json-diff');
const fse = require('fs-extra');

const attachmentsFromDir = require('../lib/attachments-from-dir');
const insertOrReplace = require('../lib/insert-or-replace');

const actionChoices = [
  { name: 'Overwrite the changes', value: 'overwrite' }, 
  { name: 'Abort so that you can update the resource', value: 'abort' }
];

const actionQuestionsWithDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a resource that has been modified since your last upload. Do you want to?',
  choices: actionChoices.concat([{ name: 'View diff', value: 'diff' }])
}];

const actionQuestionsWithoutDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a resource that has been modified since your last upload. Do you want to?',
  choices: actionChoices
}];

module.exports = async (projectDir, couchUrl) => {
  if(!couchUrl) return skipFn('no couch URL set');

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

  // Pull remote _rev
  let remoteRev = 'remoteRev';
  let remoteJson = '';
  try {
    const response = await request.get({
      method: 'GET',
      url: `${couchUrl}/resources`,
    });
    remoteJson = JSON.parse(response);
    remoteRev = remoteJson._rev;
  } catch (e) {
    // continue regardless of error
  }

  // Pull local _rev
  let localRev = 'localRev';
  try {
    localRev = fs.read(`${projectDir}/._revs/resources`);
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
      return skipFn('configuration modified');
    }
  }

  const db = pouch(couchUrl);

  try {
    await insertOrReplace(db, doc);

    const response = await request.get({
      method: 'GET',
      url: `${couchUrl}/resources`,
    });
    remoteJson = JSON.parse(response);
    remoteRev = remoteJson._rev;   

    await fse.outputFile(`${projectDir}/._revs/resources`, remoteRev);

    return Promise.resolve();
  } catch (e) {
    throw e;
  }
};
