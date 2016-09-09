'use strict';

const fs = require('fs');
const path = require('path');
const Helper = require('hubot-test-helper');
const expect = require('chai').expect;
const nock = require('nock');
const mockUtils = require('./mock.utils.cf.js');


// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	directory: __dirname + '/../src/locales',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// No cache for the tests
process.env.CACHE_TIMEOUT = '-1';

const UP_COLOR = '#008571';
const DOWN_COLOR = '#ef4e38';

const REGIONS = {
	'US South': 'ng',
	'United Kingdom': 'eu-gb',
	Sydney: 'au-syd'
};

const mockHtml = {
	ng: fs.readFileSync(path.join(__dirname, 'resources/estado-ng.html'), {encoding: 'UTF-8'}),
	'ng-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-ng-updated.html'), {encoding: 'UTF-8'}),
	'eu-gb': fs.readFileSync(path.join(__dirname, 'resources/estado-eu-gb.html'), {encoding: 'UTF-8'}),
	'eu-gb-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-eu-gb-updated.html'), {encoding: 'UTF-8'}),
	'au-syd': fs.readFileSync(path.join(__dirname, 'resources/estado-au-syd.html'), {encoding: 'UTF-8'}),
	'au-syd-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-au-syd-updated.html'), {encoding: 'UTF-8'})
};

const helper = new Helper(path.join(__dirname, '../src/scripts/ibmcloud.status.js'));

describe('Test cloud status via Natural Language', function() {

	let room;
	let cf;

	before(function() {
		mockUtils.setupMockery();
		// initialize cf, hubot-test-helper doesn't test Middleware
		cf = require('hubot-cf-convenience');
		return cf.promise.then();
	});

	beforeEach(function() {
		room = helper.createRoom();
		nock.disableNetConnect();
	});

	afterEach(function() {
		room.destroy();
	});

	context('Getting region status', function() {

		let testRegionStatus = function(region, expectedReplyAttachments, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode]);
			room.robot.on('ibmcloud.formatter', function(event) {
				try {
					if (event.attachments.length >= expectedReplyAttachments.length) {
						expect(event.attachments).to.deep.equal(expectedReplyAttachments);
						done();
					}
				}
				catch (err) {
					done(err);
				}
			});
			let res = { message: {text: 'Show me the region status of' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.region.status', res, {region: region});
		};


		it('returns status for region US South', function(done) {
			testRegionStatus('US South', [{
				title: i18n.__('healthy.region.status', 'US South'),
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR,
				text: i18n.__('healthy.services', 295 + '')
			}, {
				title: i18n.__('unhealthy.region.status', 'US South'),
				title_link: 'http://estado.ng.bluemix.net',
				color: DOWN_COLOR,
				text: '- otc-pipeline-ui\n- messageconnect [experimental]\n- MobileApplicationContentManager [Basic]'
			}], done);
		});

		it('returns status for region United Kingdom', function(done) {
			testRegionStatus('United Kingdom', [{
				title: i18n.__('healthy.region.status', 'United Kingdom'),
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: UP_COLOR,
				text: i18n.__('healthy.services', 236 + '')
			}, {
				title: i18n.__('unhealthy.region.status', 'United Kingdom'),
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: DOWN_COLOR,
				text: '- MobileApplicationContentManager [Basic]'
			}], done);
		});

		it('returns status for region Sydney', function(done) {
			testRegionStatus('Sydney', [{
				title: i18n.__('healthy.region.status', 'Sydney'),
				title_link: 'http://estado.au-syd.bluemix.net',
				color: UP_COLOR,
				text: i18n.__('healthy.services', 175 + '')
			}, {
				title: i18n.__('unhealthy.region.status', 'Sydney'),
				title_link: 'http://estado.au-syd.bluemix.net',
				color: DOWN_COLOR,
				text: '- www\n- MobileApplicationContentManager [Basic]'
			}], done);
		});

		it('should send event for missing region parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.region'));
				done();
			});
			let res = { message: {text: 'Show me the region status', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.region.status', res, {});
		});
	});

	context('Getting service status', function() {

		let testServiceStatus = function(region, service, expectedReplyAttachments, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode]);
			room.robot.on('ibmcloud.formatter', function(event) {
				try {
					if (event.attachments.length >= expectedReplyAttachments.length) {
						expect(event.attachments).to.deep.equal(expectedReplyAttachments);
						done();
					}
				}
				catch (err) {
					done(err);
				}
			});

			let res = { message: {text: 'Please obtain the status of service ' + service + 'in region ' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.status', res, {region: region, service: service});
		};

		it('returns status for service www on region US South', function(done) {
			testServiceStatus('US South', 'www', [{
				title: i18n.__('service.region.status', 'www', 'US South', 'up'),
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service otc-pipeline-ui on region US South', function(done) {
			testServiceStatus('US South', 'otc-pipeline-ui', [{
				title: i18n.__('service.region.status', 'otc-pipeline-ui', 'US South', 'down'),
				title_link: 'http://estado.ng.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});

		it('returns status for service Object-Storage-Healthcheck on region United Kingdom', function(done) {
			testServiceStatus('United Kingdom', 'Object-Storage-Healthcheck', [{
				title: i18n.__('service.region.status', 'Object-Storage-Healthcheck', 'United Kingdom', 'up'),
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service MobileApplicationContentManager [Basic] on region United Kingdom', function(done) {
			testServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', [{
				title: i18n.__('service.region.status', 'MobileApplicationContentManager [Basic]', 'United Kingdom', 'down'),
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});

		it('returns status for service APIConnect [Essentials] on region Sydney', function(done) {
			testServiceStatus('Sydney', 'APIConnect [Essentials]', [{
				title: i18n.__('service.region.status', 'APIConnect [Essentials]', 'Sydney', 'up'),
				title_link: 'http://estado.au-syd.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service www on region Sydney', function(done) {
			testServiceStatus('Sydney', 'www', [{
				title: i18n.__('service.region.status', 'www', 'Sydney', 'down'),
				title_link: 'http://estado.au-syd.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});

		it('should send event for missing region parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.service'));
				done();
			});
			let res = { message: {text: 'Please obtain the status in region US South', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.status', res, {region: 'US South'});
		});

		it('should send event for missing service parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.region'));
				done();
			});
			let res = { message: {text: 'Please obtain the status of service www', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.status', res, {service: 'www'});
		});
	});

	context('Monitoring service', function() {

		let testMonitoringServiceStatus = function(region, service, targetStatus, expectedFirstReplyAttachments, expectedSecondReplyAttachments, statusChange, done) {
			let regionCode = REGIONS[region];
			if (statusChange) {
				// First status
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
				// Second status (updated)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode + '-updated']);
			}
			else {
				// Same status twice
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.times(2)
					.reply(200, mockHtml[regionCode]);
			}
			let count = 0;
			room.robot.on('ibmcloud.formatter', function(event) {
				count++;
				try {
					if (count === 1) {
						expect(event.attachments).to.deep.equal(expectedFirstReplyAttachments);
					}
					else if (count === 2) {
						expect(event.attachments).to.deep.equal(expectedSecondReplyAttachments);
						done();
					}
				}
				catch (err) {
					done(err);
				}
			});
			let res = { message: {text: 'Notify me when the service health changes ' + service + 'in region ' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.monitor', res, {region: region, service: service, status: targetStatus});
		};

		it('monitor status for otc-pipeline-ui in US South Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('US South', 'otc-pipeline-ui', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'otc-pipeline-ui', 'US South', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: undefined,
				text: i18n.__('service.monitoring.status', 'otc-pipeline-ui', 'US South', 'UP', '2 seconds', 'DOWN'),
				title: i18n.__('service.in.region', 'otc-pipeline-ui', 'US South'),
				title_link: 'http://estado.ng.bluemix.net'
			}], false, done);
		});

		it('monitor status for otc-pipeline-ui in US South Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('US South', 'otc-pipeline-ui', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'otc-pipeline-ui', 'US South', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: UP_COLOR,
				text: i18n.__('service.status', 'UP'),
				title: i18n.__('service.in.region', 'otc-pipeline-ui', 'US South'),
				title_link: 'http://estado.ng.bluemix.net'
			}], true, done);
		});

		it('monitor status for MobileApplicationContentManager [Basic] in United Kingdom Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'MobileApplicationContentManager [Basic]', 'United Kingdom', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: undefined,
				text: i18n.__('service.monitoring.status', 'MobileApplicationContentManager [Basic]', 'United Kingdom', 'UP', '2 seconds', 'DOWN'),
				title: i18n.__('service.in.region', 'MobileApplicationContentManager [Basic]', 'United Kingdom'),
				title_link: 'http://estado.eu-gb.bluemix.net'
			}], false, done);
		});

		it('monitor status for MobileApplicationContentManager [Basic] in United Kingdom Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'MobileApplicationContentManager [Basic]', 'United Kingdom', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: UP_COLOR,
				text: i18n.__('service.status', 'UP'),
				title: i18n.__('service.in.region', 'MobileApplicationContentManager [Basic]', 'United Kingdom'),
				title_link: 'http://estado.eu-gb.bluemix.net'
			}], true, done);
		});

		it('monitor status for www in Sydney Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('Sydney', 'www', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'www', 'Sydney', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: undefined,
				text: i18n.__('service.monitoring.status', 'www', 'Sydney', 'UP', '2 seconds', 'DOWN'),
				title: i18n.__('service.in.region', 'www', 'Sydney'),
				title_link: 'http://estado.au-syd.bluemix.net'
			}], false, done);
		});

		it('monitor status for www in Sydney Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('Sydney', 'www', 'UP', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status', 'www', 'Sydney', 'UP'),
				title: i18n.__('monitoring.started')
			}], [{
				color: UP_COLOR,
				text: i18n.__('service.status', 'UP'),
				title: i18n.__('service.in.region', 'www', 'Sydney'),
				title_link: 'http://estado.au-syd.bluemix.net'
			}], true, done);
		});

		it('should send event for missing region parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.region'));
				done();
			});
			let res = { message: {text: 'Notify me when the service health changes www', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.monitor', res, {service: 'www', status: 'up'});
		});

		it('should send event for missing service parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.service'));
				done();
			});
			let res = { message: {text: 'Notify me when the service health changes in region US South', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.monitor', res, {region: 'US South', status: 'up'});
		});

		it('should send event for missing status parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.status'));
				done();
			});
			let res = { message: {text: 'Notify me when the service health changes www in region US South', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.monitor', res, {region: 'US South', service: 'www'});
		});
	});

	context('Getting space status', function() {

		let testSpaceStatus = function(region, expectedReplyAttachments, useUpdated, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode + (useUpdated ? '-updated' : '')]);
			room.robot.on('ibmcloud.formatter', function(event) {
				try {
					expect(event.attachments).to.deep.equal(expectedReplyAttachments);
					done();
				}
				catch (err) {
					done(err);
				}
			});

			let res = { message: {text: 'Please obtain the status of the services in the current space', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.space.status', res, {});
		};

		it('returns status for current space (mixed statuses)', function(done) {
			testSpaceStatus('US South', [{
				title: i18n.__('healthy.space.status', 'testSpace'),
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR,
				text: i18n.__('healthy.services', 2 + '')
			}, {
				title: i18n.__('unhealthy.space.status', 'testSpace'),
				title_link: 'http://estado.ng.bluemix.net',
				color: DOWN_COLOR,
				text: '- messageconnect [experimental]'
			}], false, done);
		});

		it('returns status for current space (all up)', function(done) {
			testSpaceStatus('US South', [{
				title: i18n.__('healthy.space.status', 'testSpace'),
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR,
				fields: [{
					title: i18n.__('services.doing.well'),
					value: i18n.__('all.services.up', 3 + '')
				}]
			}], true, done);
		});

	});

	context('Monitoring space', function() {

		it('should enable and then disable monitoring of services in the current space', function(done) {
			let expectedFirstReplyAttachments = [{
				title: i18n.__('monitoring.space.started', 'testSpace'),
				color: UP_COLOR
			}];
			let expectedSecondReplyAttachments = [{
				title: i18n.__('monitoring.space.stopped', 'testSpace'),
				color: UP_COLOR
			}];
			let count = 0;
			room.robot.on('ibmcloud.formatter', function(event) {
				count++;
				if (count === 1) {
					expect(event.attachments).to.deep.equal(expectedFirstReplyAttachments);
					let res2 = { message: {text: 'Stop notifying me when the service health changes in region US South', user: {id: 'anId'}}, response: room };
					room.robot.emit('ibmcloud.space.monitor', res2, {spacestatus: 'clear'});
				}
				else if (count === 2) {
					expect(event.attachments).to.deep.equal(expectedSecondReplyAttachments);
					done();
				}
			});
			let res = { message: {text: 'Notify me when the service health changes in region US South', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.space.monitor', res, {spacestatus: 'any'});
		});

		it('should send event for missing spacestatus parameter', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.message).to.be.a('string');
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.spacestatus'));
				done();
			});
			let res = { message: {text: 'Notify me when services in the current space change status', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.space.monitor', res, {});
		});
	});

	context('user calls `ibmcloud status help`', function() {
		it('should respond with help', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.be.a('string');
					expect(event.message).to.contain('ibmcloud status region [US South | United Kingdom | Sydney]');
					expect(event.message).to.contain('ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE]');
					done();
				}
			});
			let res = { message: {text: 'help cloud status', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.status.help', res, {});
		});
	});
});
