'use strict';

var fs = require('fs');
var path = require('path');
var Helper = require('hubot-test-helper');
var expect = require('chai').expect;
var nock = require('nock');

// No cache for the tests
process.env.CACHE_TIMEOUT = '-1';

var UP_COLOR = '#008571';
var DOWN_COLOR = '#ef4e38';

var REGIONS = {
	'US South': 'ng',
	'United Kingdom': 'eu-gb',
	Sydney: 'au-syd'
};

var mockHtml = {
	ng: fs.readFileSync(path.join(__dirname, 'resources/estado-ng.html'), {encoding: 'UTF-8'}),
	'ng-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-ng-updated.html'), {encoding: 'UTF-8'}),
	'eu-gb': fs.readFileSync(path.join(__dirname, 'resources/estado-eu-gb.html'), {encoding: 'UTF-8'}),
	'eu-gb-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-eu-gb-updated.html'), {encoding: 'UTF-8'}),
	'au-syd': fs.readFileSync(path.join(__dirname, 'resources/estado-au-syd.html'), {encoding: 'UTF-8'}),
	'au-syd-updated': fs.readFileSync(path.join(__dirname, 'resources/estado-au-syd-updated.html'), {encoding: 'UTF-8'})
};

var helper = new Helper(path.join(__dirname, '../src/scripts/ibmcloud.status.js'));

describe('Test cloud status via Natural Language', function() {

	var room;

	beforeEach(function() {
		room = helper.createRoom();
		nock.disableNetConnect();
	});

	afterEach(function() {
		room.destroy();
	});

	context('Getting region status', function() {

		var testRegionStatus = function(region, expectedReplyAttachments, done) {
			var regionCode = REGIONS[region];
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
			var res = { message: {text: 'Show me the region status of' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.region.status', res, {region: region});
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
	});

	context('Getting service status', function() {

		var testServiceStatus = function(region, service, expectedReplyAttachments, done) {
			var regionCode = REGIONS[region];
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

			var res = { message: {text: 'Please obtain the status of service ' + service + 'in region ' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.status', res, {region: region, service: service});
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

		var testMonitoringServiceStatus = function(region, service, targetStatus, expectedFirstReplyAttachments, expectedSecondReplyAttachments, statusChange, done) {
			var regionCode = REGIONS[region];
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
			var count = 0;
			room.robot.on('ibmcloud.formatter', function(event) {
				count++;
				try {
					if (count === 1) {
						expect(event.attachments).to.deep.equal(expectedFirstReplyAttachments);
						done();
					}
				}
				catch (err) {
					done(err);
				}
			});
			var res = { message: {text: 'Notify me when the service health changes ' + service + 'in region ' + region, user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.service.monitor', res, {region: region, service: service, status: targetStatus});
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
		it('should respond with help', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.be.a('string');
					expect(event.message).to.contain('ibmcloud status region [US South | United Kingdom | Sydney]');
					expect(event.message).to.contain('ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE]');
					done();
				}
			});
			var res = { message: {text: 'help cloud status', user: {id: 'anId'}}, response: room };
			room.robot.emit('ibmcloud.status.help', res, {});
		});
	});
});
