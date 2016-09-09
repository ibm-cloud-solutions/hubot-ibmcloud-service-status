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

describe('Load modules through index', function() {

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

	context('load index`', function() {
		it('should load without problems', function() {
			require('../index')(room.robot);
		});
	});
});

describe('Test cloud status via Reg Ex', function() {

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
	});

	context('Monitoring service with any/clear', function() {

		let testMonitoringServiceStatusAny = function(region, service, expectedFirstReplyAttachments, expectedSecondReplyAttachments, expectedThirdReplyAttachments, expectedFourthReplyAttachments, statusChange, done) {
			let regionCode = REGIONS[region];
			if (statusChange) {
				// First status
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
				// Second status (same)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
				// Third status (updated)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode + '-updated']);
				// Fourth status (back to original)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
			}
			else {
				// Same status four times
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.times(4)
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
						if (!statusChange) {
							done();
						}
					}
					else if (count === 3) {
						if (statusChange) {
							expect(event.attachments).to.deep.equal(expectedThirdReplyAttachments);
						}
						else {
							done(new Error('Unexpected third attachments: ' + event.attachments));
						}
					}
					else if (count === 4) {
						if (statusChange) {
							expect(event.attachments).to.deep.equal(expectedFourthReplyAttachments);
							done();
						}
						else {
							done(new Error('Unexpected fourth attachments: ' + event.attachments));
						}
					}
				}
				catch (err) {
					done(err);
				}
			});
			room.user.say('user1', '@hubot ibmcloud status monitor ' + region + ' any ' + service).then(setTimeout(function() {
				room.user.say('user1', '@hubot ibmcloud status monitor ' + region + ' clear ' + service);
			}, 4500));
		};

		it('monitor status for messageconnect [experimental] in US South Region (no status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatusAny('US South', 'messageconnect [experimental]', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status.any', 'messageconnect [experimental]', 'US South'),
				title: i18n.__('monitoring.started')
			}], [{
				title: i18n.__('monitoring.stopped', 'messageconnect [experimental]', 'US South'),
				color: UP_COLOR
			}], [], [], false, done);
		});

		it('monitor status for messageconnect [experimental] in US South Region (status change)', function(done) {
			this.timeout(5000);
			testMonitoringServiceStatusAny('US South', 'messageconnect [experimental]', [{
				color: UP_COLOR,
				text: i18n.__('monitoring.status.any', 'messageconnect [experimental]', 'US South'),
				title: i18n.__('monitoring.started')
			}], [{
				title: i18n.__('service.in.region', 'messageconnect [experimental]', 'US South'),
				title_link: 'http://estado.ng.bluemix.net',
				text: i18n.__('service.status', 'UP'),
				color: UP_COLOR
			}], [{
				title: i18n.__('service.in.region', 'messageconnect [experimental]', 'US South'),
				title_link: 'http://estado.ng.bluemix.net',
				text: i18n.__('service.status', 'DOWN'),
				color: DOWN_COLOR
			}], [{
				title: i18n.__('monitoring.stopped', 'messageconnect [experimental]', 'US South'),
				color: UP_COLOR
			}], true, done);
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
			room.user.say('user1', '@hubot ibmcloud status space').then();
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

		let testMonitoringSpace = function(region, expectedFirstReplyAttachments, expectedSecondReplyAttachments, expectedThirdReplyAttachments, expectedFourthReplyAttachments, statusChange, done) {
			let regionCode = REGIONS[region];
			if (statusChange) {
				// First status
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
				// Second status (same)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
				// Third status (updated)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode + '-updated']);
				// Fourth status (back to original)
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.reply(200, mockHtml[regionCode]);
			}
			else {
				// Same status four times
				nock('http://estado.' + regionCode + '.bluemix.net')
					.get('/')
					.times(4)
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
						if (!statusChange) {
							done();
						}
					}
					else if (count === 3) {
						if (statusChange) {
							expect(event.attachments).to.deep.equal(expectedThirdReplyAttachments);
						}
						else {
							done(new Error('Unexpected third attachments: ' + event.attachments));
						}
					}
					else if (count === 4) {
						if (statusChange) {
							expect(event.attachments).to.deep.equal(expectedFourthReplyAttachments);
							done();
						}
						else {
							done(new Error('Unexpected fourth attachments: ' + event.attachments));
						}
					}
				}
				catch (err) {
					done(err);
				}
			});
			room.user.say('user1', '@hubot ibmcloud status monitor space any').then(setTimeout(function() {
				room.user.say('user1', '@hubot ibmcloud status monitor space clear');
			}, 4500));
		};

		it('monitor space (no status change)', function(done) {
			this.timeout(7000);
			testMonitoringSpace('US South', [{
				color: UP_COLOR,
				title: i18n.__('monitoring.space.started', 'testSpace')
			}], [{
				color: UP_COLOR,
				title: i18n.__('monitoring.space.stopped', 'testSpace')
			}], [], [], false, done);
		});

		it('monitor space (status change)', function(done) {
			this.timeout(7000);
			testMonitoringSpace('US South', [{
				color: UP_COLOR,
				title: i18n.__('monitoring.space.started', 'testSpace')
			}], [{
				title: i18n.__('service.in.space', 'messageconnect [experimental]', 'testSpace'),
				title_link: 'http://estado.ng.bluemix.net',
				text: i18n.__('service.status', 'UP'),
				color: UP_COLOR
			}], [{
				title: i18n.__('service.in.space', 'messageconnect [experimental]', 'testSpace'),
				title_link: 'http://estado.ng.bluemix.net',
				text: i18n.__('service.status', 'DOWN'),
				color: DOWN_COLOR
			}], [{
				color: UP_COLOR,
				title: i18n.__('monitoring.space.stopped', 'testSpace')
			}], true, done);
		});
	});

	context('user calls `ibmcloud status help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot ibmcloud status help');
		});

		it('should respond with help', function() {
			let expectedHelp = `hubot ibmcloud status region [US South | United Kingdom | Sydney] - ${i18n.__('ibmcloud.status.region.help')}\n`;
			expectedHelp += `hubot ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE] - ${i18n.__('ibmcloud.status.service.help')}\n`;
			expectedHelp += `hubot ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN|ANY|CLEAR][SERVICE] - ${i18n.__('ibmcloud.status.monitor.help', '|')}\n`;
			expectedHelp += `hubot ibmcloud status space - ${i18n.__('ibmcloud.status.space.help')}\n`;
			expectedHelp += `hubot ibmcloud status monitor space [ANY|CLEAR] - ${i18n.__('ibmcloud.status.monitor.space.help', '|')}\n`;
			expect(room.messages.length).to.eql(2);
			expect(room.messages[1]).to.eql(['hubot', `@mimiron ${expectedHelp}`]);
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
