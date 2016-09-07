/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const statusModule = require('./estado');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

const NAMESPACE = 'IBMcloudStatus';
const PARAM_SERVICE = 'service';

let functionsRegistered = false;


function buildGlobalFuncName(parameterName) {
	return NAMESPACE + '_func' + parameterName;
}

function registerEntityFunctions() {
	if (!functionsRegistered) {
		nlcconfig.setGlobalEntityFunction(buildGlobalFuncName(PARAM_SERVICE), getServices);
		functionsRegistered = true;
	}
}

function getDomain(region) {
	let lowercaseText = region.toLowerCase();
	switch (lowercaseText) {
	case 'us south':
		return 'ng';
	case 'united kingdom':
		return 'eu-gb';
	case 'sydney':
		return 'au-syd';
	default:
		return undefined;
	}
}

function getServices(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		if (parameters.region) {
			let domain = getDomain(parameters.region);
			statusModule.getStatus(domain).then(function(result) {
				let services = result.ok.concat(result.ko).sort();
				resolve(services);
			}).catch(function(err) {
				reject(err);
			});
		}
		else {
			reject(new Error('Unable to get service names for a region because the region name has not been set'));
		}
	});
}

module.exports.registerEntityFunctions = registerEntityFunctions;
module.exports.getServices = getServices;
