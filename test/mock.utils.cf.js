/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const nock = require('nock');
nock.disableNetConnect();
nock.enableNetConnect('localhost');

const endpoint = 'http://my.ng.test';
const cfVersion = 'v2';

module.exports = {

	setupMockery: function() {
		let cfScope = nock(endpoint)
			.persist();

		// https://apidocs.cloudfoundry.org/236/info/get_info.html
		cfScope.get(`/${cfVersion}/info`)
			.reply(200, { authorization_endpoint: 'http://my.ng.test/uaa' });

		// https://apidocs.cloudfoundry.org/236/organizations/list_all_organizations.html
		cfScope.get(`/${cfVersion}/organizations`)
			.reply(200,
			{
				resources: [
					{
						metadata: {
							guid: 'testOrgGuid'
						},
						entity: {
							name: 'testOrg'
						}
					}
				]
			});

		// https://apidocs.cloudfoundry.org/236/organizations/get_organization_summary.html
		cfScope.get(`/${cfVersion}/organizations/testOrgGuid/summary`)
			.reply(200,
			{
				spaces: [
					{
						guid: 'testSpaceGuid',
						name: 'testSpace',
						app_count: 2,
						service_count: 1,
						mem_dev_total: 0
					}
				]
			});

		// https://apidocs.cloudfoundry.org/236/spaces/get_space_summary.html
		cfScope.get(`/${cfVersion}/spaces/testSpaceGuid/summary`)
			.reply(200,
			{
				apps: [
					{
						guid: 'testApp1Guid',
						urls: [
							'testApp1Url'
						],
						name: 'testApp1Name',
						instances: 1,
						running_instances: 1,
						state: 'STARTED',
						memory: 1024,
						disk_quota: 1024,
						service_names: [
							'cloudantNoSQLDB'
						]
					},
					{
						guid: 'testApp2Guid',
						urls: [
							'testApp2Url'
						],
						name: 'testApp2Name',
						instances: 1,
						running_instances: 1,
						state: 'STOPPED',
						memory: 1024,
						disk_quota: 1024,
						service_names: []
					},
					{
						guid: 'testApp4Guid',
						urls: [
							'testApp4Url'
						],
						name: 'testApp4Name',
						instances: 1,
						running_instances: 1,
						state: 'STOPPED',
						memory: 1024,
						disk_quota: 1024,
						service_names: []
					},
					{
						guid: 'testAppLongLogsGuid',
						urls: [
							'testAppLongLogsUrl'
						],
						name: 'testAppLongLogsName',
						instances: 1,
						running_instances: 1,
						state: 'STARTED',
						memory: 1024,
						disk_quota: 1024,
						service_names: [
							'messageconnect',
							'Object-Storage'
						]
					}
				],
				services: [
					{
						guid: 'cloudantNoSQLDBGuid',
						name: 'cloudantNoSQLDB',
						bound_app_count: 1,
						service_plan: {
							service: {
								label: 'cloudantNoSQLDB'
							},
							name: 'Shared'
						}
					},
					{
						guid: 'messageconnectGuid',
						name: 'messageconnect',
						bound_app_count: 0,
						service_plan: {
							service: {
								label: 'messageconnect'
							},
							name: 'experimental'
						}
					},
					{
						guid: 'Object-StorageGuid',
						name: 'Object-Storage',
						bound_app_count: 0,
						service_plan: {
							service: {
								label: 'Object-Storage'
							},
							name: 'standard'
						}
					}
				]
			});


		cfScope.post('/uaa/oauth/token')
			.reply(200, { access_token: 'mycredformockservice' });

	}
};
