Medic Project Configurer
========================

<a href="https://travis-ci.org/medic/medic-conf"><img src="https://travis-ci.org/medic/medic-conf.svg?branch=master"/></a>

# Requirements

* nodejs 8 or later
* python 2.7
* or Docker


# Installation

## Docker

	docker build -t medic-conf:v0 .
	docker run medic-conf:v0
	docker exec -it <container_name> /bin/bash

## Ubuntu

	npm install -g medic-conf
	sudo python -m pip install git+https://github.com/medic/pyxform.git@medic-conf-1.17#egg=pyxform-medic

## OSX

	npm install -g medic-conf
	pip install git+https://github.com/medic/pyxform.git@medic-conf-1.17#egg=pyxform-medic

## Windows

As Administrator:

	npm install -g medic-conf
	python -m pip install git+https://github.com/medic/pyxform.git@medic-conf-1.17#egg=pyxform-medic --upgrade

## Bash completion

To enable tab completion in bash, add the following to your `.bashrc`/`.bash_profile`:

	eval "$(medic-conf --shell-completion bash)"

## Upgrading

To upgrade to the latest version

	npm install -g medic-conf

# Usage

`medic-conf` will upload the configuration **_from your current directory_**.

## Specifying the server to configure

### localhost

	medic-conf --local

### A specific Medic instance

	medic-conf --instance=instance-name.dev

Username `admin` is used.  A prompt is shown for entering password.

If a different username is required, add the `--user` switch:

	--user user-name --instance=instance-name.dev

### An arbitrary URL

	medic-conf --url=https://username:password@example.com:12345

## Perform specific action(s)

	medic-conf <--local|--instance=instance-name|--url=url> <...action>

The list of available actions can be seen via `medic-conf --help`.

## Perform actions for specific forms

	medic-conf <--local|--instance=instance-name|--url=url> <...action> -- <...form>

# Currently supported

## App Settings

* compile from:
  - tasks
  - rules
  - schedules
  - contact-summary
  - purge
* backup from server
* upload to server

## Forms

* fetch from google docs/google sheets/google drive and save locally as `.xlsx`
* backup from server
* delete all forms from server
* delete specific form from server
* upload to server

## Resources

* upload to server

## Translations

* upload of custom translations to the server

## create-users **[ALPHA]**

N.B. this feature is currently in development, and probably not ready for production yet.

To create users on a remote server, use the `create-users` action.  The CSV file should be called `users.csv`, and an example is available [in the tests directory](test/data/create-users), for [an existing place](test/data/create-users/existing-place) and [a new place](test/data/create-users/new-place).

## csv-to-docs

To convert CSV to JSON docs, use the `csv-to-docs` action.

### CSV File Name

_The name of the file determines the type of doc created for rows contained in the file. The possible types are: `report`, `person`, and `place`. Each of these has a further specifier provided in the filename:_
- `place.{place_type}.csv`:  where `{place_type}` is the type of place specified in the file, one of: `clinic`, `health_center`, `district_hospital`
- `person.{parent_place_type}.csv`:  where `{parent_place_type}` is the parent for the person, one of: `clinic`, `health_center`, `district_hospital`
- `report.{form_id}.csv`:  where `{form_id}` is the form ID for all the reports in the file. You will need one file per form ID

Here are some examples:

File named place.district_hospital.csv  adds the property `"type":"district_hospital"`<br/>
File named person.clinic.csv add the property `"type":"person"`<br/>
File named report.immunization_visit.csv add the property `"type":"report", "form":"immunization_visit"`<br/>

### Property Types

By default, values are parsed as strings.  To parse a CSV column as a JSON type, suffix a data type to the column definition, e.g.

	column_one,column_two:bool,column_three:int,column_four:float,column_five:date,column_six:timestamp

This would create a structure such as:

	{
		"_id": "09efb53f-9cd8-524c-9dfd-f62c242f1817",
		"column_one": "some string",
		"column_two": true,
		"column_three": 1,
		"column_four": 2.3,
		"column_five": "2017-12-31T00:00:00.000Z",
		"column_six": 1513255007072
	}

### Excluded Columns

To exclude a column from the final object structure, give it the type `excluded`:

	my_column_that_will_not_be_a_property:excluded

This can be useful if using a column for doc references.

### Doc References

In the reference example below. A property on the JSON doc will be populated with the doc that matches the `WHERE` statement.
The CSV example below using the reference will find the doc with `district_1` and create a `parent` property with the value of the `district_1` doc

To reference other docs, replace the type suffix with a matching clause:

	parent:place WHERE reference_id=COL_VAL

Refered to CSV Example:

| reference_id:excluded | is_name_generated | name | reported_date:timestamp |
| --------------------- | ----------------- | ---- | ----------------------- |
| district_1            | false             | D1   | 1544031155715           |
| district_2            | false             | D2   | 1544031155715           |
| district_3            | false             | D3   | 1544031155715           |

### CSV Using Reference 

| reference_id:excluded | parent:place WHERE reference_id=COL_VAL | is_name_generated | name | reported_date:timestamp |
| --------------------- | --------------------------------------- | ----------------- | ---- | ----------------------- |
| health_center_1       | district_1                              | false             | HC1  |  1544031155715           |
| health_center_2       | district_2                              | false             | HC2  |  1544031155715           |
| health_center_3       | district_3                              | false             | HC3  |  1544031155715           |

This would create a structure such as:

```
{
  "type": "health_center",
  //Parent Property with district_1 doc as the value
  "parent": {
    "type": "district_hospital",
    "parent": "",
    "is_name_generated": "false",
    "name": "D2",
    "external_id": "",
    "notes": "",
    "geolocation": "",
    "reported_date": 1544031155715,
    "_id": "f223f240-5d6a-5a7a-91d4-46d3c59de73e"
  },
  "is_name_generated": "false",
  "name": "HC7",
  "external_id": "",
  "notes": "",
  "geolocation": "",
  "reported_date": 1544031155715,
  "_id": "480d0cd0-c021-5d55-8c63-d86576d592fc"
}
```

### Doc Property References

To reference specific properties of other docs:

	parent:GET _id OF place WHERE reference_id=COL_VAL

In this example the `health_ccenter` doc will have a `property` of `parent` set to the `_id` of the refered to doc `district_1` property of `_id`

NOTE: `_id` is a generated value that is inside the generated docs. 

Refered to CSV Example:

| reference_id:excluded | is_name_generated | name | reported_date:timestamp |
| --------------------- | ----------------- | ---- | ----------------------- |
| district_1            | false             | D1   | 1544031155715           |
| district_2            | false             | D2   | 1544031155715           |
| district_3            | false             | D3   | 1544031155715           |

CSV Using Reference 

| reference_id:excluded | parent:GET _id OF place WHERE reference_id=COL_VAL | is_name_generated | name | reported_date:timestamp |
| --------------------- | -------------------------------------------------- | ----------------- | ---- | ----------------------- |
| health_center_1       | district_1                                         | false             | HC1  | 1544031155715           |
| health_center_2       | district_2                                         | false             | HC2  | 1544031155715           |
| health_center_3       | district_3                                         | false             | HC3  | 1544031155715           |


This would create a structure such as:

```
{
  "type": "health_center",
  //Parent property with the _id from district_1 as the value.
  "parent": "0c31056a-3a80-54dd-b136-46145d451a66",
  "is_name_generated": "false",
  "name": "HC3",
  "external_id": "",
  "notes": "",
  "geolocation": "",
  "reported_date": 1544031155715,
  "_id": "45293356-353c-5eb1-9a41-baa3427b4f69"
}
```

Note the special string `COL_VAL` - this matches the CSV column value for the row being processed.

## Moving Contacts within the Hierarchy

Contacts are organized into a hierarchy. It is not straight-forward to move contacts from one position in the hierarchy to another because many copies of this hierarchy exist. Use the `move-contacts` action to assign a new parent to contacts. This command will move the specified contact, all the contacts under that contact, and all reports created by any of those contacts. This action will download all documents that need to be updated, update the lineages within those documents, and then save the updated documents on your local disk. To commit those changes to the database, run the `upload-docs` action.

**Offline users who have contacts removed from their visible hierarchy will not automatically see those contacts disappear. The contact remains on the user's device. Any updates made to the contact (or any reports created for that contact) will silently fail to sync (medic/medic/#5701). These users must be encouraged to clear cache and resync!** Also impactful, but less serious - this script can cause significant amounts of changes to the database and offline users who have contacts moved into their visible hierarchy may experience lengthy and bandwidth-intensive synchronizations.

Parameter | Description | Required 
-- | -- | --
contacts | Comma delimited list of contact IDs which will be moved | Yes
parent | ID of the new parent which will be assigned to the provided contacts | Yes
docDirectoryPath | This action outputs files to local disk at this destination | No. Default `json-docs`

Some constraints when moving contacts:

* **Allowed Parents** - When moving contacts on WebApp &gt;v3.7, your chosen parent must be listed as a valid parent for the contact as defined in the [configuration for place hierarchy](https://github.com/medic/medic-docs/blob/master/configuration/app-settings.md#configuring-place-hierarchy). For WebApp &lt;v3.7, the default hierarchy is enforced.
* **Circular Hierarchy** - Nobody's parent can ever be themself or their child.
* **Primary Contacts** - Primary contacts must be a descendant of the place for which they are the primary contact. You may need to select a new primary contact for a place through the WebApp if you'd like to move a primary contact to a new place in the hierarchy.
* **Minification** - Due to contact "minification" (#2635) which was implemented in v2.13, this script should not be used for versions prior to v2.13.

### Examples
Move the contacts with the id `contact_1` and `contact_2` to have the parent `parent_id`. The changes will be in the local folder `my_folder` only for review. Run the second command to upload the changes after review.

    medic-conf --instance= move-contacts -- --contacts=contact_1,contact_2 --parent=parent_id --docDirectoryPath=my_folder
    medic-conf --local upload-docs -- --docDirectoryPath=my_folder

Move the contact with the id `contact_1` to the top of the hierarchy (no parent).

    medic-conf --local move-contacts upload-docs -- --contacts=contact_1 --parent=root


# Project Layout

This tool expects a project to be structured as follows:

	example-project/
		.eslintrc
		app_settings.json
		contact-summary.js
		purge.js
		resources.json
		resources/
			icon-one.png
			…
		targets.js
		tasks.js
		task-schedules.json
		forms/
			app/
				my_project_form.xlsx
				my_project_form.xml
				my_project_form.properties.json
				my_project_form-media/
					[extra files]
					…
			contact/
				person-create.xlsx
				person-create.xml
				person-create-media/
					[extra files]
					…
			…
			…
		translations/
			messages-xx.properties
			…
			
If you are starting from scratch you can initialise the file layout using the `initialise-project-layout` action:

    medic-conf initialise-project-layout
    
## Derived configs

Configuration can be inherited from another project, and then modified.  This allows the `app_settings.json` and contained files (`task-schedules.json`, `targets.json` etc.) to be imported, and then modified.

To achieve this, create a file called `settings.inherit.json` in your project's root directory with the following format:

	{
		"inherit": "../path/to/other/project",
		"replace": {
			"keys.to.replace": "value-to-replace-it-with"
		},
		"merge": {
			"complex.objects": {
				"will_be_merged": true
			}
		},
		"delete": [
			"all.keys.listed.here",
			"will.be.deleted"
		],
		"filter": {
			"object.at.this.key": [
				"will",
				"keep",
				"only",
				"these",
				"properties"
			]
		}
	}

# `medic-logs`

Fetch logs from a production server.

This is a standalone command installed alongside `medic-conf`.  For usage information, run `medic-logs --help`.

## Usage

	medic-logs <instance-name> <log-types...>

Accepted log types:

	api
	couchdb
	gardener
	nginx
	sentinel

## Testing Locally

1. Clone the project locally
1. Make changes to medic-conf or checkout a branch for testing
1. Test changes 
	1. To test CLI changes locally you can run `node <project_dir>/src/bin/medic-conf.js`. This will run as if you installed via npm. 
	1. To test changes that are imported in code run `npm install <project_dir>` to use the local version of medic-conf.

## compress images

To compress PNGs and SVGs in the current directory and its subdirectories, two commands are available:

	compress-pngs
	compress-svgs

## Wishlist

* only upload things which have changed (this could be a separate mode - e.g. `update` vs `configure`)

# Releasing

1. Create a pull request. Get it reviewed and approved.
1. Run `npm version patch`, `npm version minor`, or `npm version major` as appropriate.
1. Merge the pull request.

# Copyright

Copyright 2013-2018 Medic Mobile, Inc. <hello@medicmobile.org>

# License

The software is provided under AGPL-3.0. Contributions to this project are accepted under the same license.
