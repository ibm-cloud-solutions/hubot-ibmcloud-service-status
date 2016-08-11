/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

var request = require('superagent');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

var CACHE_TIMEOUT = Number.parseInt(process.env.CACHE_TIMEOUT, 10) || 60000;

console.log('Using cache timeout of ' + CACHE_TIMEOUT + ' ms');

var _lastStatus = {
	ng: undefined,
	'eu-gb': undefined,
	'au-syd': undefined
};

function _getRawStatus(domain) {
	return new Promise(function(resolve, reject) {
		if (_lastStatus[domain] && Date.now() < (_lastStatus[domain].timestamp + CACHE_TIMEOUT)) {
			resolve(_lastStatus[domain].text);
		}
		else {
			request.get('http://estado.' + domain + '.bluemix.net/')
			.end(function(err, res) {
				if (err) {
					reject(err);
				}
				else {
					console.log('updating _lastStatus for domain ' + domain + ' with string of length ' + (res.text ? res.text.length : 0));
					_lastStatus[domain] = {
						text: res.text,
						timestamp: Date.now()
					};
					resolve(_lastStatus[domain].text);
				}
			});
		}
	});
};

/**
 * Get bluemix status for a domain
 * @param domain supported domains: ng, eu-gb, au-syd
 * @returns {Promise}
 */
function getStatus(domain) {
	return new Promise(function(resolve, reject) {
		_getRawStatus(domain).then(function(res) {
			try {
				var ok = [];
				var ko = [];
				var total = 0;
				var $ = cheerio.load(res);
				var serviceNames = [];
				$('table tr').each(function() {
					var row = $(this);
					if (row.attr('class') !== 'info') {
						var cols = $('td', row);
						var service = cols.first().text();
						var stat = cols.last().text();
						serviceNames.push(service);
						total++;
						if (stat !== 'up') {
							ko.push(service);
						}
						else {
							ok.push(service);
						}
					}
				});
				nlcconfig.updateGlobalParameterValues('IBMcloudStatus_service', serviceNames);
				resolve({
					ok: ok,
					ko: ko
				});
			}
			catch (error) {
				console.error(error);
				reject(error);
			}
		}, function(err) {
			reject(err);
		});
	});
};

/**
 * Get status for a Bluemix service on a domain
 * @param domain the domain
 * @param service the service
 */
function getServiceStatus(domain, service) {
	return new Promise(function(resolve, reject) {
		_getRawStatus(domain).then(function(res) {
			try {
				var $ = cheerio.load(res);
				var status = 'unknown';
				$('table tr').each(function() {
					var row = $(this);
					if (row.attr('class') !== 'info') {
						var cols = $('td', row);
						if (cols.first().text() === service) {
							status = cols.last().text();
							return false;
						}
					}
				});
				resolve(status);
			}
			catch (error) {
				reject(error);
			}
		}, function(err) {
			reject(err);
		});
	});
};

module.exports = exports = {
	getStatus: getStatus,
	getServiceStatus: getServiceStatus
};
