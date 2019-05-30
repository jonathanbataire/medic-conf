const fs = require('../lib/sync-fs');
const request = require('request-promise-native');
const skipFn = require('../lib/skip-fn');
const inquirer = require('inquirer');
const jsonDiff = require('json-diff');
const fse = require('fs-extra');

const actionChoices = [
  { name: 'Overwrite the changes', value: 'overwrite' }, 
  { name: 'Abort so that you can update the configuration', value: 'abort' }
];

const actionQuestionsWithDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a configuration that has been modified since your last upload. Do you want to?',
  choices: actionChoices.concat([{ name: 'View diff', value: 'diff' }])
}];

const actionQuestionsWithoutDiff = [{
  type: 'list',
  name: 'action',
  message: 'You are trying to modify a configuration that has been modified since your last upload. Do you want to?',
  choices: actionChoices
}];

module.exports = async (projectDir, couchUrl) => {
  const body = fs.read(`${projectDir}/app_settings.json`);

  if(!couchUrl) return skipFn('no couch URL set');

  // Pull remote _rev
  let remoteRev = 'remoteRev';
  let remoteJson = '';
  try {
    const response = await request.get({
      method: 'GET',
      url: `${couchUrl}/settings`,
    });
    remoteJson = JSON.parse(response);
    remoteRev = remoteJson._rev;
  } catch (e) {}

  // Pull local _rev
  let localRev = 'localRev';
  try {
    localRev = fs.read(`${projectDir}/._revs/settings`);
  } catch (e) {}

  // Compare _revs
  // If _revs are different, show prompt
  if (localRev !== remoteRev) {
    let response = await inquirer.prompt(actionQuestionsWithDiff);
    if (response.action === 'diff') {
      // Show diff
      console.log(jsonDiff.diffString(remoteJson.settings, JSON.parse(body)));

      response = await inquirer.prompt(actionQuestionsWithoutDiff);
    }
    if (response.action === 'abort') {
      return skipFn('configuration modified');
    }
  }

  try {
    let response = await request.put({
        method: 'PUT',
        url: `${couchUrl}/_design/medic/_rewrite/update_settings/medic?replace=1`,
        headers: { 'Content-Type':'application/json' },
        body: body,
    });
    const responseJson = JSON.parse(response);

    // As per https://github.com/medic/medic-webapp/issues/3674, this endpoint
    // will return 200 even when upload fails.
    if(!responseJson.success) throw new Error(responseJson.error);

    response = await request.get({
      method: 'GET',
      url: `${couchUrl}/settings`,
    });
    remoteJson = JSON.parse(response);
    remoteRev = remoteJson._rev;   

    await fse.outputFile(`${projectDir}/._revs/settings`, remoteRev);

    return Promise.resolve();
  } catch (e) {
    throw e;
  }
};
