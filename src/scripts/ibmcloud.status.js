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

const path = require('path');
const TAG = path.basename(__filename);

const statusModule = require('../lib/estado');
const cf = require('hubot-cf-convenience');
const activity = require('hubot-ibmcloud-activity-emitter');
const entities = require('../lib/status.entities');


// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
const i18n = new (require('i18n-2'))({
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
const SERVICE_MONITOR_RE = /ibmcloud\s+status\s+monitor\s+(US South|United Kingdom|Sydney)\s+(up|down|any|clear)\s+(.*)/i;
const SERVICE_MONITOR_ID = 'ibmcloud.service.monitor';
const SPACE_STATUS_RE = /ibmcloud\s+status\s+space/i;
const SPACE_STATUS_ID = 'ibmcloud.space.status';
const SPACE_MONITOR_RE = /ibmcloud\s+status\s+monitor\s+space\s+(any|clear)/i;
const SPACE_MONITOR_ID = 'ibmcloud.space.monitor';

module.exports = function(robot) {
	const COLORS = {
		healthy: '#008571',
		outage: '#ef4e38'
	};

	let NOTIFICATION_PERIOD_IN_MS = Number.parseInt(process.env.NOTIFICATION_PERIOD_IN_MS, 10) || 60000;
	let NOTIFICATION_TIMEOUT = {
		label: process.env.NOTIFICATION_TIMEOUT_LABEL || '8 hours', // eslint-disable-line no-irregular-whitespace
		value: Number.parseInt(process.env.NOTIFICATION_TIMEOUT_VALUE, 10) || 8 * 60 * 60000
	};

	(function() {
		let logMessage = [
			'Using the following notifications settings:',
			'- Notification period: ' + NOTIFICATION_PERIOD_IN_MS + ' ms',
			'- Notification timeout: ' + NOTIFICATION_TIMEOUT.value + ' ms',
			'- Label for notification timeout: ' + NOTIFICATION_TIMEOUT.label
		];
		robot.logger.info(TAG + ': ' + logMessage.join('\n'));
	})();

	// Domain contants
	const DOMAIN_USSOUTH = 'ng';
	const DOMAIN_UK = 'eu-gb';
	const DOMAIN_SYDNEY = 'au-syd';
	const DOMAINS = [
		DOMAIN_USSOUTH,
		DOMAIN_UK,
		DOMAIN_SYDNEY
	];

	// Region/domain info
	let REGION_INFO = {};
	DOMAINS.forEach(function(domain) {
		REGION_INFO[domain] = {
			domain: domain,
			url: 'http://estado.' + domain + '.bluemix.net'
		};
	});
	REGION_INFO[DOMAIN_USSOUTH].region = 'US South';
	REGION_INFO[DOMAIN_UK].region = 'United Kingdom';
	REGION_INFO[DOMAIN_SYDNEY].region = 'Sydney';

	// Notification request definitions
	let notificationRequestMap = {
	};
	DOMAINS.forEach(function(domain) {
		notificationRequestMap[domain] = {
			monitoredServices: [],  // Each item in array is an object with three fields: service, monitorStatus, and res
			monitoredSpace: [],  // Each item in array is an object with one field: res
			prevStatus: null,
			currStatus: null
		};
	});

	function regionInfoForDomain(domain) {
		return REGION_INFO[domain];
	}
	function regionInfoForRegion(text) {
		let lowercaseText = text.toLowerCase();
		let domains = Object.keys(REGION_INFO);
		for (let i = 0; i < domains.length; i++) {
			let ri = REGION_INFO[domains[i]];
			if (ri.region.toLowerCase() === lowercaseText) {
				return ri;
			}
		}
		return undefined;
	}
	function regionInfoForEnv() {
		let bluemixApi = process.env.HUBOT_BLUEMIX_API;
		let domains = Object.keys(REGION_INFO);
		for (let i = 0; i < domains.length; i++) {
			let ri = REGION_INFO[domains[i]];
			if (bluemixApi.indexOf('.' + ri.domain + '.') >= 0) {
				return ri;
			}
		}
		return undefined;
	}

	setInterval(function() {

		// Process each of the notification requests for each of the regions(domains)
		Object.keys(notificationRequestMap).forEach(function(domain) {

			let notificationRequest = notificationRequestMap[domain];
			let regionInfo = regionInfoForDomain(domain);

			// See if any monitoring requests have been made for this domain
			if (notificationRequest.monitoredServices.length > 0 || notificationRequest.monitoredSpace.length > 0) {
				notificationRequest.prevStatus = notificationRequest.currStatus;
				robot.logger.info(`${TAG}: checking service status for services in domain ${domain}`);

				// Get current status of all services in this domain
				statusModule.getStatus(domain).then(function(resp) {
					notificationRequest.currStatus = resp;

					// Check status of all explicitly monitored services.
					// If the status being monitored is down and the service is down,
					// then send message to the user and remove the monitoring item
					// (this is a one-time alert).
					// If the status being monitored is up and the service is up,
					// then send message to the user and remove the monitoring item
					// (this too is a one-time alert).
					// If the status being monitored is any and the service has
					// transitioned to up or down, then send message to the user
					// (do not remove the monitoring item because this is a persistent alert).
					// Process services in reverse order so that they can be easily removed
					// from the array if the expected status is found.
					for (let i = notificationRequest.monitoredServices.length - 1; i >= 0; i--) {
						let monitoredService = notificationRequest.monitoredServices[i];
						let prevStatus = 'unknown';
						if (notificationRequest.prevStatus != null) {
							prevStatus = (notificationRequest.prevStatus.ok.indexOf(monitoredService.service) >= 0 ? 'up' : (notificationRequest.prevStatus.ko.indexOf(monitoredService.service) >= 0 ? 'down' : 'unknown'));
						}
						let currStatus = (notificationRequest.currStatus.ok.indexOf(monitoredService.service) >= 0 ? 'up' : (notificationRequest.currStatus.ko.indexOf(monitoredService.service) >= 0 ? 'down' : 'unknown'));
						let monitoredServiceRemoved = false;

						// If current status for service is down, then see if we need to send alert msg.
						if (currStatus === 'down') {

							// If the status being monitored is down or the status being monitored
							// is any and the previous status was up, then send message to the user.
							if ((monitoredService.monitorStatus === 'down') ||
								(monitoredService.monitorStatus === 'any' && prevStatus === 'up')) {

								// Send message to the user
								robot.emit('ibmcloud.formatter', {
									response: monitoredService.res,
									attachments: [{
										title: i18n.__('service.in.region', monitoredService.service, regionInfo.region),
										title_link: regionInfo.url,
										text: i18n.__('service.status', 'DOWN'),
										color: COLORS.outage
									}]
								});
								activity.emitBotActivity(robot, monitoredService.res, { activity_id: 'activity.service.monitor'});

								// If the status being monitored is not 'any' then remove the service from
								// the list since this is a one-time alert.
								if (monitoredService.monitorStatus !== 'any') {
									notificationRequest.monitoredServices.splice(i, 1);
									monitoredServiceRemoved = true;
								}

							}

						}

						// If current status for service is up, then see if we need to send alert msg.
						else if (currStatus === 'up') {

							// If the status being monitored is up or the status being monitored
							// is any and the previous status was down, then send message to the user.
							if ((monitoredService.monitorStatus === 'up') ||
								(monitoredService.monitorStatus === 'any' && prevStatus === 'down')) {

								// Send message to the user
								robot.emit('ibmcloud.formatter', {
									response: monitoredService.res,
									attachments: [{
										title: i18n.__('service.in.region', monitoredService.service, regionInfo.region),
										title_link: regionInfo.url,
										text: i18n.__('service.status', 'UP'),
										color: COLORS.healthy
									}]
								});
								activity.emitBotActivity(robot, monitoredService.res, { activity_id: 'activity.service.monitor'});

								// If the status being monitored is not 'any' then remove the service from
								// the list since this is a one-time alert.
								if (monitoredService.monitorStatus !== 'any') {
									notificationRequest.monitoredServices.splice(i, 1);
									monitoredServiceRemoved = true;
								}

							}

						}

						// If the monitorStatus is not 'any' and the monitor timeout is exceed then
						// remove the service from the list.
						if (monitoredServiceRemoved === false && monitoredService.monitorStatus !== 'any' &&
							(Date.now() - monitoredService.timestamp > NOTIFICATION_TIMEOUT.value)) {

							// Send message to user
							robot.emit('ibmcloud.formatter', {
								response: monitoredService.res,
								attachments: [{
									title: i18n.__('service.in.region', monitoredService.service, regionInfo.region),
									title_link: regionInfo.url,
									text: i18n.__('service.monitoring.status', monitoredService.service, regionInfo.region, monitoredService.monitorStatus.toUpperCase(), NOTIFICATION_TIMEOUT.label, prevStatus.toUpperCase()),
									color: undefined
								}]
							});
							activity.emitBotActivity(robot, monitoredService.res, { activity_id: 'activity.service.monitor'});

							// Remove the service from the list since it has timed out
							notificationRequest.monitoredServices.splice(i, 1);

						}
					}

					// If the active space is being monitored and it is in this domain,
					// then determine if any services in the active space have changed status.
					// If so, send message to the user(s).  This is a persistent alert so nothing
					// is removed from the notification request.
					if (notificationRequest.monitoredSpace.length > 0) {

						// Go through each requesting user and obtain their current space
						notificationRequest.monitoredSpace.forEach(function(monitoredSpace) {
							let activeSpace = cf.activeSpace(robot, monitoredSpace.res);

							// Get all services in their current space
							getServicesInSpace(activeSpace.guid).then(function(services) {

								services.forEach(function(service) {
									let prevStatus = 'unknown';
									if (notificationRequest.prevStatus != null) {
										prevStatus = (notificationRequest.prevStatus.ok.indexOf(service) >= 0 ? 'up' : (notificationRequest.prevStatus.ko.indexOf(service) >= 0 ? 'down' : 'unknown'));
									}
									let currStatus = (notificationRequest.currStatus.ok.indexOf(service) >= 0 ? 'up' : (notificationRequest.currStatus.ko.indexOf(service) >= 0 ? 'down' : 'unknown'));

									// If the current status is down
									if (currStatus === 'down') {

										// If the previous status was up, send message to requesting users
										if (prevStatus === 'up') {

											// Send message to the user
											robot.emit('ibmcloud.formatter', {
												response: monitoredSpace.res,
												attachments: [{
													title: i18n.__('service.in.space', service, activeSpace.name),
													title_link: regionInfo.url,
													text: i18n.__('service.status', 'DOWN'),
													color: COLORS.outage
												}]
											});
											activity.emitBotActivity(robot, monitoredSpace.res, { activity_id: 'activity.service.monitor'});

										}

									}

									// If the current status is up
									else if (currStatus === 'up') {

										// If the previous status was down, send message to requesting users
										if (prevStatus === 'down') {

											// Send message to the user
											robot.emit('ibmcloud.formatter', {
												response: monitoredSpace.res,
												attachments: [{
													title: i18n.__('service.in.space', service, activeSpace.name),
													title_link: regionInfo.url,
													text: i18n.__('service.status', 'UP'),
													color: COLORS.healthy
												}]
											});
											activity.emitBotActivity(robot, monitoredSpace.res, { activity_id: 'activity.service.monitor'});

										}

									}

								});

							}).catch(function(err) {
								robot.logger.error(`${TAG}: An error occurred.`);
								robot.logger.error(err);
							});

						});

					}

				}).catch(function(err) {
					robot.logger.error(`${TAG}: An error occurred.`);
					robot.logger.error(err);
				});

			}

			// If we didn't get the status this time through, then wipe it out
			else {
				notificationRequest.prevStatus = null;
				notificationRequest.currStatus = null;
			}

		});
	}, NOTIFICATION_PERIOD_IN_MS);

	let reportIssue = function(res, message) {
		robot.logger.error(`${TAG}: An error occurred.`);
		robot.logger.error(message);
		let msg = i18n.__('error');
		robot.emit('ibmcloud.formatter', { response: res, message: msg});
	};

	// Register entity handling functions
	entities.registerEntityFunctions();

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
		let regionInfo = regionInfoForRegion(aRegion);
		let region = regionInfo.domain;
		robot.logger.info(`${TAG}: Asynch call using status module to check on domain ${region}`);
		statusModule.getStatus(region).then(function(resp) {
			let attachments = [];
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
		let regionInfo = regionInfoForRegion(aRegion);
		let region = regionInfo.domain;
		let service = cf.getServiceLabel(aService);
		robot.logger.info(`${TAG}: Asynch call using status module to check on service ${service} in domain ${region}`);
		statusModule.getServiceStatus(region, service).then(function(status) {
			let color = status === 'up' ? COLORS.healthy : COLORS.outage;

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
		const status = res.match[2];
		serviceMonitor(res, region, service, status);
	});
	function serviceMonitor(res, aRegion, aService, theStatus) {
		robot.logger.debug(`${TAG}: ${SERVICE_MONITOR_ID} res.message.text=${res.message.text}.`);
		let regionInfo = regionInfoForRegion(aRegion);
		let domain = regionInfo.domain;
		let status = theStatus.toLowerCase();
		let service = cf.getServiceLabel(aService);

		// See if this user is currently monitoring this service in this domain
		let matchIndex = -1;
		let notificationRequest = notificationRequestMap[domain];
		for (let i = 0; i < notificationRequest.monitoredServices.length; i++) {
			let monitoredService = notificationRequest.monitoredServices[i];
			if (service === monitoredService.service && res.message.user.id === monitoredService.res.message.user.id) {
				matchIndex = i;
				break;
			}
		}

		// If monitoring a service
		if (status === 'up' || status === 'down' || status === 'any') {

			// If this user is not currently monitoring this service, then add an
			// item to the notification request.
			if (matchIndex < 0) {
				notificationRequest.monitoredServices.push({
					service: service,
					monitorStatus: status,
					res: res,
					timestamp: Date.now()
				});
			}

			// If the user is currently monitoring this service, then update the item
			// in the notification request.
			else {
				notificationRequest.monitoredServices[matchIndex] = {
					service: service,
					monitorStatus: status,
					res: res
				};
			}

			// Notify user that service is now being monitored
			let theText = (status === 'any'
				? i18n.__('monitoring.status.any', service, aRegion)
				: i18n.__('monitoring.status', service, aRegion, status.toUpperCase()));
			// Emit the app status as an attachment
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('monitoring.started'),
					text: theText,
					color: COLORS.healthy
				}]
			});

		}

		// If clearing the monitoring of a service
		else {

			// If service was being monitored by this user, then remove it
			if (matchIndex >= 0) {
				notificationRequest.monitoredServices.splice(matchIndex, 1);
			}

			// Notify user that service is no longer being monitored
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('monitoring.stopped', service, aRegion),
					color: COLORS.healthy
				}]
			});

		}

	};

	robot.on(SPACE_STATUS_ID, (res, parameters) => {
		robot.logger.debug(`${TAG}: ${SPACE_STATUS_ID} Natural Language match.`);
		spaceStatus(res);
	});
	robot.respond(SPACE_STATUS_RE, {id: SPACE_STATUS_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${SPACE_STATUS_ID} Reg Ex match.`);
		spaceStatus(res);
	});
	function getServicesInSpace(activeSpaceGuid) {
		return new Promise(function(resolve, reject) {
			cf.Spaces.getSummary(activeSpaceGuid).then(function(result) {
				let services = [];
				result.services.forEach(function(service) {
					if (service.service_plan) {
						services.push(service.service_plan.service.label + ' [' + service.service_plan.name + ']');
					}
				});
				resolve(services);
			}).catch(function(err) {
				reject(err);
			});
		});
	}
	function getStatusForServicesInSpace(activeSpaceGuid, domain) {
		return new Promise(function(resolve, reject) {
			getServicesInSpace(activeSpaceGuid).then(function(services) {
				statusModule.getStatus(domain).then(function(resp) {
					let newresp = {
						ok: [],
						ko: [],
						unknown: []
					};
					services.forEach(function(service) {
						if (resp.ok.indexOf(service) >= 0) {
							if (newresp.ok.indexOf(service) < 0) {
								newresp.ok.push(service);
							}
						}
						else if (resp.ko.indexOf(service) >= 0) {
							if (newresp.ko.indexOf(service) < 0) {
								newresp.ko.push(service);
							}
						}
						else {
							if (newresp.unknown.indexOf(service) < 0) {
								newresp.unknown.push(service);
							}
							robot.logger.debug(`${TAG}: Service ${service} not found in list of estado services.`);
						}
					});
					resolve(newresp);
				}).catch(function(err) {
					reject(err);
				});
			}).catch(function(err) {
				reject(err);
			});
		});
	};
	function spaceStatus(res) {
		robot.logger.debug(`${TAG}: ${REGION_STATUS_ID} res.message.text=${res.message.text}.`);
		let activeSpace = cf.activeSpace(robot, res);
		let regionInfo = regionInfoForEnv();
		getStatusForServicesInSpace(activeSpace.guid, regionInfo.domain).then(function(resp) {
			let attachments = [];
			if (resp.ko.length > 0) {
				attachments.push({
					title: i18n.__('healthy.space.status', activeSpace.name),
					title_link: regionInfo.url,
					color: COLORS.healthy || '#555',
					text: i18n.__('healthy.services', resp.ok.length + resp.unknown.length + '')
				});

				attachments.push({
					title: i18n.__('unhealthy.space.status', activeSpace.name),
					title_link: regionInfo.url,
					color: COLORS.outage || '#555',
					text: '- ' + resp.ko.join('\n- ')
				});

			}
			else {
				attachments.push({
					title: i18n.__('healthy.space.status', activeSpace.name),
					title_link: regionInfo.url,
					color: COLORS.healthy || '#555',
					fields: [{
						title: i18n.__('services.doing.well'),
						value: i18n.__('all.services.up', resp.ok.length + resp.unknown.length + '')
					}]
				});
			}

			// Emit the app status as an attachment
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: attachments
			});
			activity.emitBotActivity(robot, res, { activity_id: 'activity.space.status'});
		}).catch(function(err) {
			reportIssue(res, err);
		});
	};

	robot.on(SPACE_MONITOR_ID, (res, parameters) => {
		robot.logger.debug(`${TAG}: ${SPACE_MONITOR_ID} Natural Language match.`);
		let spacestatus;
		if (parameters && parameters.spacestatus) {
			spacestatus = parameters.spacestatus;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Status from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.spacestatus');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (spacestatus) {
			spaceMonitor(res, spacestatus);
		}
	});
	robot.respond(SPACE_MONITOR_RE, {id: SPACE_MONITOR_ID}, function(res) {
		robot.logger.debug(`${TAG}: ${SPACE_MONITOR_ID} Reg Ex match.`);
		const spacestatus = res.match[1];
		spaceMonitor(res, spacestatus);
	});
	function spaceMonitor(res, spacestatus) {
		robot.logger.debug(`${TAG}: ${REGION_STATUS_ID} res.message.text=${res.message.text}.`);
		let activeSpace = cf.activeSpace(robot, res);
		let regionInfo = regionInfoForEnv();
		let status = spacestatus.toLowerCase();

		// See if this user is currently monitoring the current space
		let matchIndex = -1;
		let notificationRequest = notificationRequestMap[regionInfo.domain];
		for (let i = 0; i < notificationRequest.monitoredSpace.length; i++) {
			let monRes = notificationRequest.monitoredSpace[i].res;
			if (monRes.message.user.id === res.message.user.id) {
				matchIndex = i;
				break;
			}
		}

		// If monitoring the current space
		if (status === 'any') {

			// If the current space is not currently being monitored by this user, add it
			if (matchIndex < 0) {
				notificationRequest.monitoredSpace.push({
					res: res
				});
			}

			// If the current space is currently being monitored by this user, update it
			else {
				notificationRequest.monitoredSpace[matchIndex] = {
					res: res
				};
			}

			// Notify user that current space is now being monitored
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('monitoring.space.started', activeSpace.name),
					color: COLORS.healthy
				}]
			});

		}

		// If clearing the monitoring of the current space
		else {

			// If current space was being monitored by this user, then remove it
			if (matchIndex >= 0) {
				notificationRequest.monitoredSpace.splice(matchIndex, 1);
			}

			// Notify user that service is no longer being monitored
			robot.emit('ibmcloud.formatter', {
				response: res,
				attachments: [{
					title: i18n.__('monitoring.space.stopped', activeSpace.name),
					color: COLORS.healthy
				}]
			});

		}

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
		let regionHelp = i18n.__('ibmcloud.status.region.help');
		let serviceHelp = i18n.__('ibmcloud.status.service.help');
		let monitorHelp = i18n.__('ibmcloud.status.monitor.help', '|');
		let spaceHelp = i18n.__('ibmcloud.status.space.help');
		let monitorSpaceHelp = i18n.__('ibmcloud.status.monitor.space.help', '|');
		let help = `${robot.name} ibmcloud status region [US South | United Kingdom | Sydney] - ${regionHelp}\n`;
		help += `${robot.name} ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE] - ${serviceHelp}\n`;
		help += `${robot.name} ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN|ANY|CLEAR][SERVICE] - ${monitorHelp}\n`;
		help += `${robot.name} ibmcloud status space - ${spaceHelp}\n`;
		help += `${robot.name} ibmcloud status monitor space [ANY|CLEAR] - ${monitorSpaceHelp}\n`;
		robot.emit('ibmcloud.formatter', { response: res, message: help});
	};

};
