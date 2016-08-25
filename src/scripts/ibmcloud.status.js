// Description:
//	Monitor IBM Cloud service status
//
// Commands:
//	 hubot ibmcloud status help - Show available commands in the ibmcloud status category.
//
// Author:
//	Sebastien Brunot
//
/*
* Licensed Materials - Property of IBM
* (C) Copyright IBM Corp. 2016. All Rights Reserved.
* US Government Users Restricted Rights - Use, duplication or
* disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
*/

'use strict';

var path = require('path');
var TAG = path.basename(__filename);

var statusModule = require('../lib/estado');
var Promise = require('bluebird');
const cf = require('hubot-cf-convenience');
const activity = require('hubot-ibmcloud-activity-emitter');


// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
var i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	directory: __dirname + '/../locales',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

const CLOUD_STATUS_HELP_RE = /ibmcloud\s+status\s+help/i;
const CLOUD_STATUS_HELP_ID = 'ibmcloud.status.help';
const REGION_STATUS_RE = /ibmcloud\s+status\s+region\s+(US South|United Kingdom|Sydney)/i;
const REGION_STATUS_ID = 'ibmcloud.region.status';
const SERVICE_STATUS_RE = /ibmcloud\s+status\s+service\s+(US South|United Kingdom|Sydney)\s+(.*)/i;
const SERVICE_STATUS_ID = 'ibmcloud.service.status';
const SERVICE_MONITOR_RE = /ibmcloud\s+status\s+monitor\s+(US South|United Kingdom|Sydney)\s+(up|down)\s+(.*)/i;
const SERVICE_MONITOR_ID = 'ibmcloud.service.monitor';

module.exports = function(robot) {
	var COLORS = {
		healthy: '#008571',
		outage: '#ef4e38'
	};

	var NOTIFICATION_PERIOD_IN_MS = Number.parseInt(process.env.NOTIFICATION_PERIOD_IN_MS, 10) || 60000;
	var NOTIFICATION_TIMEOUT = {
		label: process.env.NOTIFICATION_TIMEOUT_LABEL || '8 hours', // eslint-disable-line no-irregular-whitespace
		value: Number.parseInt(process.env.NOTIFICATION_TIMEOUT_VALUE, 10) || 8 * 60 * 60000
	};
	var MAX_NB_OF_NOTIFICATIONS = Number.parseInt(process.env.MAX_NB_OF_NOTIFICATIONS, 10) || 20;

	(function() {
		var logMessage = [
			'Using the following notifications settings:',
			'- Notification period: ' + NOTIFICATION_PERIOD_IN_MS + ' ms',
			'- Notification timeout: ' + NOTIFICATION_TIMEOUT.value + ' ms',
			'- Label for notification timeout: ' + NOTIFICATION_TIMEOUT.label,
			'- Max number of notifications: ' + MAX_NB_OF_NOTIFICATIONS
		];
		robot.logger.info(TAG + ': ' + logMessage.join('\n'));
	})();

	var notificationRequests = [];

	setInterval(function() {
		if (notificationRequests.length) {
			robot.logger.info(`${TAG}: checking service status for ${notificationRequests.length} notification requests`);

			var promises = [];
			notificationRequests.forEach(function(request) {
				robot.logger.info(`${TAG}: Promise added to check if service ${request.service} is ${request.status} on domain ${request.domain}`);
				promises.push(statusModule.getServiceStatus(request.domain, request.service).then(function(lastStatus) {
					if (request.status === lastStatus) {
						var color = lastStatus === 'up' ? COLORS.healthy : COLORS.outage;
						robot.emit('ibmcloud.formatter', {
							response: request.res,
							attachments: [{
								title: i18n.__('service.in.region', request.service, request.region),
								title_link: request.regionUrl,
								text: i18n.__('service.status', lastStatus.toUpperCase()),
								color: color
							}]
						});
						activity.emitBotActivity(robot, request.res, { activity_id: 'activity.service.monitor'});
						return false;
					}
					else if (Date.now() - request.timestamp > NOTIFICATION_TIMEOUT.value) {
						robot.emit('ibmcloud.formatter', {
							response: request.res,
							attachments: [{
								title: i18n.__('service.in.region', request.service, request.region),
								title_link: request.regionUrl,
								text: i18n.__('service.monitoring.status', request.service, request.region, request.status.toUpperCase(), NOTIFICATION_TIMEOUT.label, lastStatus.toUpperCase()),
								color: color
							}]
						});
						activity.emitBotActivity(robot, request.res, { activity_id: 'activity.service.monitor'});
						return false;
					}
					else {
						// Keep the notification in the array
						return true;
					}
				}, function(err) {
					robot.logger.error(`${TAG}: An error occurred.`);
					robot.logger.error(err);
					return true;
				}).reflect());
			});
			robot.logger.info(`${TAG}: Async calls (Promise.all) for service checks (promises).`);
			Promise.all(promises).then(function(values) {
				notificationRequests = notificationRequests.filter(function(entry, index) {
					var inspection = values[index];
					if (inspection.isFulfilled()) {
						var value = inspection.value();
						if (!value) {
							// delete the bot res object from the notification
							delete entry.res;
						}
						return value;
					}
					else {
						return true;
					}
				});
				robot.logger.info(`${TAG}: notificationRequests length is now ${notificationRequests.length}`);
			});
		}
	}, NOTIFICATION_PERIOD_IN_MS);

	function regionForInputText(text) {
		var lowercaseText = text.toLowerCase();
		switch (lowercaseText) {
		case 'us south':
			return {
				domain: 'ng',
				url: 'http://estado.ng.bluemix.net'
			};
		case 'united kingdom':
			return {
				domain: 'eu-gb',
				url: 'http://estado.eu-gb.bluemix.net'
			};
		case 'sydney':
			return {
				domain: 'au-syd',
				url: 'http://estado.au-syd.bluemix.net'
			};
		default:
			{
				return undefined;
			}
		}
	}

	var reportIssue = function(res, message) {
		robot.logger.error(`${TAG}: An error occurred.`);
		robot.logger.error(message);
		let msg = i18n.__('error');
		robot.emit('ibmcloud.formatter', { response: res, message: msg});
	};

	robot.on(CLOUD_STATUS_HELP_ID, (res) => {
		robot.logger.debug(`${TAG}: ${CLOUD_STATUS_HELP_ID} Natural Language match.`);
		help(res);
	});
	robot.respond(CLOUD_STATUS_HELP_RE, {id: CLOUD_STATUS_HELP_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${CLOUD_STATUS_HELP_ID} Reg Ex match.`);
		help(res);
	});
	function help(res) {
		robot.logger.info(`${TAG}: ${CLOUD_STATUS_HELP_ID} Listing ibmcloud status help...`);
		// hubot ibmcloud status region [US South | United Kingdom | Sydney] - Provide status for ibmcloud services in region.
		// hubot ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE] - Provide status for ibmcloud service named [SERVICE] in region.
		// hubot ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN][SERVICE] - Monitor and send notifications when [SERVICE] in region goes [UP|DOWN].
		let regionHelp = i18n.__('ibmcloud.status.region.help');
		let serviceHelp = i18n.__('ibmcloud.status.service.help');
		let monitorHelp = i18n.__('ibmcloud.status.monitor.help', '|');
		let help = `${robot.name} ibmcloud status region [US South | United Kingdom | Sydney] - ${regionHelp}\n`;
		help += `${robot.name} ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE] - ${serviceHelp}\n`;
		help += `${robot.name} ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN][SERVICE] - ${monitorHelp}\n`;
		robot.emit('ibmcloud.formatter', { response: res, message: help});
	};

	robot.on(REGION_STATUS_ID, (res, parameters) => {
		robot.logger.debug(`${TAG}: ${REGION_STATUS_ID} Natural Language match.`);
		if (parameters && parameters.region) {
			regionStatus(res, parameters.region);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting cloud Region from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.region');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});
	robot.respond(REGION_STATUS_RE, {id: REGION_STATUS_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${REGION_STATUS_ID} Reg Ex match.`);
		const region = res.match[1];
		regionStatus(res, region);
	});
	function regionStatus(res, aRegion) {
		robot.logger.debug(`${TAG}: ${REGION_STATUS_ID} res.message.text=${res.message.text}.`);
		var regionInfo = regionForInputText(aRegion);
		var region = regionInfo.domain;
		robot.logger.info(`${TAG}: Asynch call using status module to check on domain ${region}`);
		statusModule.getStatus(region).then(function(resp) {
			var attachments = [];
			if (resp.ko.length) {
				attachments.push({
					title: i18n.__('healthy.region.status', aRegion),
					title_link: regionInfo.url,
					color: COLORS.healthy || '#555',
					text: i18n.__('healthy.services', resp.ok.length + '')
				});

				attachments.push({
					title: i18n.__('unhealthy.region.status', aRegion),
					title_link: regionInfo.url,
					color: COLORS.outage || '#555',
					text: '- ' + resp.ko.join('\n- ')
				});

			}
			else {
				attachments.push({
					title: i18n.__('healthy.region.status', aRegion),
					title_link: regionInfo.url,
					color: COLORS.healthy || '#555',
					fields: [{
						title: i18n.__('services.doing.well'),
						value: i18n.__('all.services.up', resp.ok.length + '')
					}]
				});
			}

			// Emit the app status as an attachment
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: attachments
			});
			activity.emitBotActivity(robot, res, { activity_id: 'activity.region.status'});
		},
		function(err) {
			reportIssue(res, err);
		});
	};

	robot.on(SERVICE_STATUS_ID, (res, parameters) => {
		robot.logger.debug(`${TAG}: ${SERVICE_STATUS_ID} Natural Language match.`);
		let region;
		let service;
		if (parameters && parameters.region) {
			region = parameters.region;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting cloud Region from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.region');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (parameters && parameters.service) {
			service = parameters.service;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Service from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.service');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		console.log(region);
		console.log(service);
		if (region && service){
			serviceStatus(res, region, service);
		}
	});
	robot.respond(SERVICE_STATUS_RE, {id: SERVICE_STATUS_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${SERVICE_STATUS_ID} Reg Ex match.`);
		const region = res.match[1];
		const service = res.match[2];
		serviceStatus(res, region, service);
	});
	function serviceStatus(res, aRegion, aService) {
		robot.logger.debug(`${TAG}: ${SERVICE_STATUS_ID} res.message.text=${res.message.text}.`);
		var regionInfo = regionForInputText(aRegion);
		var region = regionInfo.domain;
		var service = cf.getServiceLabel(aService);
		robot.logger.info(`${TAG}: Asynch call using status module to check on service ${service} in domain ${region}`);
		statusModule.getServiceStatus(region, service).then(function(status) {
			var color = status === 'up' ? COLORS.healthy : COLORS.outage;

			// Emit the app status as an attachment
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('service.region.status', service, aRegion, status),
					title_link: regionInfo.url,
					color: color
				}]
			});
			robot.logger.info(`${TAG}: Status for service ${service} in domain ${region} is ${status}`);
			activity.emitBotActivity(robot, res, { activity_id: 'activity.service.status'});
		}, function(err) {
			reportIssue(res, err);
		});
	};

	robot.on(SERVICE_MONITOR_ID, (res, parameters) => {
		robot.logger.debug(`${TAG}: ${SERVICE_MONITOR_ID} Natural Language match.`);
		let region;
		let service;
		let status;
		if (parameters && parameters.region) {
			region = parameters.region;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting cloud Region from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.region');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (parameters && parameters.service) {
			service = parameters.service;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Service from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.service');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (parameters && parameters.status) {
			status = parameters.status;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Status from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.status');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (region && service && status){
			serviceMonitor(res, region, service, status);
		}
	});
	robot.respond(SERVICE_MONITOR_RE, {id: SERVICE_MONITOR_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${SERVICE_STATUS_ID} Reg Ex match.`);
		const region = res.match[1];
		const service = res.match[3];
		const status = res.match[2].toLowerCase();
		serviceMonitor(res, region, service, status);
	});
	function serviceMonitor(res, aRegion, aService, theStatus) {
		robot.logger.debug(`${TAG}: ${SERVICE_MONITOR_ID} res.message.text=${res.message.text}.`);
		var regionInfo = regionForInputText(aRegion);
		var domain = regionInfo.domain;
		var status = theStatus;
		var service = cf.getServiceLabel(aService);
		if (notificationRequests.length < MAX_NB_OF_NOTIFICATIONS) {
			notificationRequests.push({
				timestamp: Date.now(),
				service: service,
				domain: domain,
				region: aRegion,
				regionUrl: regionInfo.url,
				status: status,
				res: res
			});
			// Emit the app status as an attachment
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('monitoring.started'),
					text: i18n.__('monitoring.status', service, aRegion, status.toUpperCase()),
					color: COLORS.healthy
				}]
			});
		}
		else {
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('max.registered'),
					color: COLORS.outage
				}]
			});
		}
	};

};
