const fs = require('../lib/sync-fs');
const info = require('../lib/log').info;
const request = require('request-promise-native');

module.exports = (projectDir, couchUrl) => {
  if(!couchUrl) throw new Error('Server URL must be defined to use this function.');
  const instanceUrl = couchUrl.replace(/\/medic$/, '');

  return Promise.resolve()
    .then(() => {
      const csvPath = `${projectDir}/users.csv`;

      if(!fs.exists(csvPath)) throw new Error(`User csv file not found at ${csvPath}`);

      const { cols, rows } = fs.readCsv(csvPath);
      const usernameIndex = cols.indexOf('username');
      const passwordIndex = cols.indexOf('password');
      const rolesIndex = cols.indexOf('roles');

      // we will no longer use these columns
      //const placeIdIndex = cols.indexOf('place');
      //const contactIndex = cols.indexOf('contact');

      // TODO : change prefixedProperties or write similar function that parses the prefixed columns
      // example
      // contact.name   contact.phone   contact.parent.name  contact.gender    contact.village    contact.parent.parent._id
      // Mary Kane      0723111111      place                F                 Kizibira           <some uuid>
      // creates this row property
      // contact: {
      //   name: 'Mary kane',
      //   phone: 0723111111,
      //   gender: 'F',
      //   parent: {
      //     name: 'place',
      //     parent: { _id: <some uuid>  }
      //   }
      // }
      //
      // Go over every row and determine which contact to create separately and upload
      // after creating the contacts, go over every row and replace the newly created contact with the new uuids

      return rows.reduce((promiseChain, row) => {
        const username = row[usernameIndex];
        const password = row[passwordIndex];
        const roles     = row[rolesIndex].split(':');


        //const contact = contactIndex === -1 ? prefixedProperties(cols, row, 'contact.') : row[contactIndex];
        //const place = placeIdIndex === -1 ? prefixedProperties(cols, row, 'place.') : row[placeIdIndex];

        const place = row.contact.parent; // this is a mockup.
        const contact = row.contact; // this is a mockup
        // you can choose to create all person and place docs in the step above and just send uuids as these fields in the request
        // or you can just create documents that are 2 levels above the user that you're trying to create.

        const requestObject = { username, password, roles, place, contact };

        return promiseChain
          .then(() => {
            info('Creating user', username);
            return request({
              uri: `${instanceUrl}/api/v1/users`,
              method: 'POST',
              json: true,
              body: requestObject,
            });
          });
      }, Promise.resolve());
    });
};

/*function prefixedProperties (cols, row, prefix) {
 const indices = {};
 cols.forEach(col => {
 if (col.startsWith(prefix)) {
 indices[col.substring(prefix.length)] = row[cols.indexOf(col)];
 }
 });
 return indices;
 }*/
