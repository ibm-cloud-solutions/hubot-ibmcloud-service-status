'use strict';

const fs = require('fs');
const path = require('path');
const Helper = require('hubot-test-helper');
const expect = require('chai').expect;
const nock = require('nock');

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

describe('Test cloud status via Reg Ex', function() {

	let room;

	beforeEach(function() {
		room = helper.createRoom();
		nock.disableNetConnect();
		// Force all emits into a reply.
		room.robot.on('ibmcloud.formatter', function(event) {
			if (event.message) {
				event.response.reply(event.message);
			}
			else {
				event.response.send({attachments: event.attachments});
			}
		});
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
					expect(event.attachments).to.deep.equal(expectedReplyAttachments);
					done();
				}
				catch (err) {
					done(err);
				}
			});
			room.user.say('user1', '@hubot ibmcloud status region ' + region).then();
		};

		it('returns status for region US South', function(done) {
			testRegionStatus('US South', [{
				title: 'US South Region Healthy Services',
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR,
				text: '295 healthy services.'
			}, {
				title: 'US South Region Service Outages',
				title_link: 'http://estado.ng.bluemix.net',
				color: DOWN_COLOR,
				text: '- otc-pipeline-ui\n- messageconnect [experimental]\n- MobileApplicationContentManager [Basic]'
			}], done);
		});

		it('returns status for region United Kingdom', function(done) {
			testRegionStatus('United Kingdom', [{
				title: 'United Kingdom Region Healthy Services',
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: UP_COLOR,
				text: '236 healthy services.'
			}, {
				title: 'United Kingdom Region Service Outages',
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: DOWN_COLOR,
				text: '- MobileApplicationContentManager [Basic]'
			}], done);
		});

		it('returns status for region Sydney', function(done) {
			testRegionStatus('Sydney', [{
				title: 'Sydney Region Healthy Services',
				title_link: 'http://estado.au-syd.bluemix.net',
				color: UP_COLOR,
				text: '175 healthy services.'
			}, {
				title: 'Sydney Region Service Outages',
				title_link: 'http://estado.au-syd.bluemix.net',
				color: DOWN_COLOR,
				text: '- www\n- MobileApplicationContentManager [Basic]'
			}], done);
		});

		// TODO: DOES NOT RESPOND WHEN UNKNOWN REGION
	});

	context('Getting service status', function() {

		let testServiceStatus = function(region, service, expectedReplyAttachments, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode]);
			room.robot.on('ibmcloud.formatter', function(event) {
				try {
					expect(event.attachments).to.deep.equal(expectedReplyAttachments);
					done();
				}
				catch (err) {
					done(err);
				}
			});
			room.user.say('user1', '@hubot ibmcloud status service ' + region + ' ' + service).then();
		};

		it('returns status for service www on region US South', function(done) {
			testServiceStatus('US South', 'www', [{
				title: 'www in US South Region is up',
				title_link: 'http://estado.ng.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service otc-pipeline-ui on region US South', function(done) {
			testServiceStatus('US South', 'otc-pipeline-ui', [{
				title: 'otc-pipeline-ui in US South Region is down',
				title_link: 'http://estado.ng.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});

		it('returns status for service Object-Storage-Healthcheck on region United Kingdom', function(done) {
			testServiceStatus('United Kingdom', 'Object-Storage-Healthcheck', [{
				title: 'Object-Storage-Healthcheck in United Kingdom Region is up',
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service MobileApplicationContentManager [Basic] on region United Kingdom', function(done) {
			testServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', [{
				title: 'MobileApplicationContentManager [Basic] in United Kingdom Region is down',
				title_link: 'http://estado.eu-gb.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});

		it('returns status for service APIConnect [Essentials] on region Sydney', function(done) {
			testServiceStatus('Sydney', 'APIConnect [Essentials]', [{
				title: 'APIConnect [Essentials] in Sydney Region is up',
				title_link: 'http://estado.au-syd.bluemix.net',
				color: UP_COLOR
			}], done);
		});

		it('returns status for service www on region Sydney', function(done) {
			testServiceStatus('Sydney', 'www', [{
				title: 'www in Sydney Region is down',
				title_link: 'http://estado.au-syd.bluemix.net',
				color: DOWN_COLOR
			}], done);
		});
	});

	context('Monitoring service', function() {

		before(function() {
			process.env.NOTIFICATION_PERIOD_IN_MS = 1000;
			process.env.NOTIFICATION_TIMEOUT_VALUE = 2000;
			process.env.NOTIFICATION_TIMEOUT_LABEL = '2 seconds';
		});

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
					else {
						expect(event.attachments).to.deep.equal(expectedSecondReplyAttachments);
						done();
					}
				}
				catch (err) {
					done(err);
				}
			});
			room.user.say('user1', '@hubot ibmcloud status monitor ' + region + ' ' + targetStatus + ' ' + service).then();
		};

		it('monitor status for otc-pipeline-ui in US South Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('US South', 'otc-pipeline-ui', 'UP', [{
				color: UP_COLOR,
				text: 'otc-pipeline-ui in US South with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: undefined,
				text: 'The status of service otc-pipeline-ui in region US South is still not UP after 2 seconds (current value: DOWN), Stopping monitor now.',
				title: 'otc-pipeline-ui in US South Region',
				title_link: 'http://estado.ng.bluemix.net'
			}], false, done);
		});

		it('monitor status for otc-pipeline-ui in US South Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('US South', 'otc-pipeline-ui', 'UP', [{
				color: UP_COLOR,
				text: 'otc-pipeline-ui in US South with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: UP_COLOR,
				text: 'Service is UP.',
				title: 'otc-pipeline-ui in US South Region',
				title_link: 'http://estado.ng.bluemix.net'
			}], true, done);
		});

		it('monitor status for MobileApplicationContentManager [Basic] in United Kingdom Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', 'UP', [{
				color: UP_COLOR,
				text: 'MobileApplicationContentManager [Basic] in United Kingdom with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: undefined,
				text: 'The status of service MobileApplicationContentManager [Basic] in region United Kingdom is still not UP after 2 seconds (current value: DOWN), Stopping monitor now.',
				title: 'MobileApplicationContentManager [Basic] in United Kingdom Region',
				title_link: 'http://estado.eu-gb.bluemix.net'
			}], false, done);
		});

		it('monitor status for MobileApplicationContentManager [Basic] in United Kingdom Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('United Kingdom', 'MobileApplicationContentManager [Basic]', 'UP', [{
				color: UP_COLOR,
				text: 'MobileApplicationContentManager [Basic] in United Kingdom with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: UP_COLOR,
				text: 'Service is UP.',
				title: 'MobileApplicationContentManager [Basic] in United Kingdom Region',
				title_link: 'http://estado.eu-gb.bluemix.net'
			}], true, done);
		});

		it('monitor status for www in Sydney Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('Sydney', 'www', 'UP', [{
				color: UP_COLOR,
				text: 'www in Sydney with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: undefined,
				text: 'The status of service www in region Sydney is still not UP after 2 seconds (current value: DOWN), Stopping monitor now.',
				title: 'www in Sydney Region',
				title_link: 'http://estado.au-syd.bluemix.net'
			}], false, done);
		});

		it('monitor status for www in Sydney Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatus('Sydney', 'www', 'UP', [{
				color: UP_COLOR,
				text: 'www in Sydney with UP status.',
				title: 'Service monitoring started'
			}], [{
				color: UP_COLOR,
				text: 'Service is UP.',
				title: 'www in Sydney Region',
				title_link: 'http://estado.au-syd.bluemix.net'
			}], true, done);
		});
	});

	context('user calls `ibmcloud status help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot ibmcloud status help');
		});

		it('should respond with help', function() {
			expect(room.messages.length).to.eql(2);
			expect(room.messages[1]).to.eql(['hubot', '@mimiron hubot ibmcloud status region [US South | United Kingdom | Sydney] - Provide status for IBM Cloud services in region.\nhubot ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE] - Provide status for IBM Cloud service named [SERVICE] in region.\nhubot ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN][SERVICE] - Monitor and send notifications when [SERVICE] in region goes [UP|DOWN].\n']);
		});
	});

	context('verify entity functions', function() {

		let testGetServices = function(region, expCount, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode]);
			const entities = require('../src/lib/status.entities');
			let res = { message: {text: '', user: {id: 'mimiron'}}, response: room };
			entities.getServices(room.robot, res, 'service', {region: region}).then(function(services) {
				expect(services.length).to.eql(expCount);
				done();
			}).catch(function(error) {
				done(error);
			});
		};

		let testGetServicesError = function(region, done) {
			let regionCode = REGIONS[region];
			nock('http://estado.' + regionCode + '.bluemix.net')
				.get('/')
				.reply(200, mockHtml[regionCode]);
			const entities = require('../src/lib/status.entities');
			let res = { message: {text: '', user: {id: 'mimiron'}}, response: room };
			entities.getServices(room.robot, res, 'service', {}).then(function(services) {
				done(new Error('Expected error but did not get one'));
			}).catch(function(error) {
				if (error) {
					done();
				}
				else {
					done(new Error('Catch block invoked, but no error; expected to get one.'));
				}
			});
		};

		it('should retrieve set of services', function(done) {
			testGetServices('US South', 298, done);
		});

		it('should retrieve set of services', function(done) {
			testGetServices('United Kingdom', 237, done);
		});

		it('should retrieve set of services', function(done) {
			testGetServices('Sydney', 177, done);
		});

		it('should retrieve set of services', function(done) {
			testGetServices('other', 0, done);
		});

		it('should get error retrieving set of services; no region provided', function(done) {
			testGetServicesError('US South', done);
		});
	});
});
