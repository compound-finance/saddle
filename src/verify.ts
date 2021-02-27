import * as fs from 'fs';
import * as path from 'path';
import {
  getContractBuild,
  loadContractAddress
} from './contract';
import AbiCoder from 'web3-eth-abi';
import { info, debug, warn, error } from './logger';
import { Result, getEtherscanApiUrl, get, post } from './etherscan';
import { SaddleConfig } from './config';

interface DevDoc {
  author: string
  methods: object
  title: string
}

interface UserDoc {
  methods: object
  notice: string
}

async function sleep(timeout): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(() => resolve(), timeout);
  })
}

// From https://etherscan.io/contract-license-types
const licenses = {
  NO_LICENSE: 1,
  THE_UNLICENSE: 2,
  MIT: 3,
  GPLv2: 4,
  GPLv3: 5,
  LGLPv2_1: 6,
  LGPLv3: 7,
  BSD2: 8,
  BSD3: 9,
  MPL2: 10,
  OSL3: 11,
  APACHE2: 12
};

async function checkStatus(url: string, apiKey: string, token: string, verbose: number): Promise<void> {
  info(`Checking status of ${token}...`, verbose);

  // Potential results:
  // { status: '0', message: 'NOTOK', result: 'Fail - Unable to verify' }
  // { status: '0', message: 'NOTOK', result: 'Pending in queue' }
  // { status: '1', message: 'OK', result: 'Pass - Verified' }

  let result: Result = <Result>await get(url, {
    apikey: apiKey,
    guid: token,
    module: "contract",
    action: "checkverifystatus"
  });

  info(JSON.stringify(result), verbose);

  if (result.result === "Pending in queue") {
    await sleep(5000);
    return await checkStatus(url, apiKey, token, verbose);
  }

  if (result.result.startsWith('Fail')) {
    throw new Error(`Etherscan failed to verify contract: ${result.message} "${result.result}"`)
  }

  if (Number(result.status) !== 1) {
    throw new Error(`Etherscan Error: ${result.message} "${result.result}"`)
  }

  info(`Verification result ${result.result}...`, verbose);
}

const importRegex = /^\s*import\s*\"([^\"]+)\"[\s;]*$/mig;

function getConstructorABI(abi: {type: string, inputs: any[]}[], contractArgs: (string|string[])[]): string {
  const constructorAbi = abi.find((x) => x.type === 'constructor');

  if (!constructorAbi) {
    return "0x";
  } else {
    return (<any>AbiCoder).encodeParameters(constructorAbi.inputs, contractArgs);
  }
}

export async function etherscanVerify(saddle_config: SaddleConfig, network: string, apiKey: string, address: string, contractName: string, contractArgs: (string|string[])[], verbose: number): Promise<void> {
  info(`Verifying contract ${contractName} at ${address} with args ${JSON.stringify(contractArgs)}`, verbose);

  let contractBuild = await getContractBuild(contractName, saddle_config);
  let metadata = JSON.parse((<any>contractBuild).metadata);
  let compilerVersion: string = contractBuild.version.replace(/\+commit\.([0-9a-fA-F]+)\..*/gi, '+commit.$1');
  let constructorAbi = Array.isArray(contractArgs) ? getConstructorABI(typeof(contractBuild.abi) === 'string' ? JSON.parse(contractBuild.abi) : contractBuild.abi, contractArgs) : contractArgs;
  let url = getEtherscanApiUrl(network);
  let language = metadata.language;
  let settings = metadata.settings;
  let sources = Object.fromEntries(Object.entries(metadata.sources).map(([contract, data]) => {
    let {license, ...rest} = <any>data; // Remove license key

    return [contract, rest];
  }));
  let target = Object.entries(settings.compilationTarget)[0].join(':');
  delete settings.compilationTarget;

  const verifyData: object = {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    codeformat: 'solidity-standard-json-input',
    contractaddress: address,
    sourceCode: JSON.stringify({language, settings, sources}),
    contractname: target,
    compilerversion: `v${compilerVersion}`,
    constructorArguements: constructorAbi.slice(2),
    licenseType: licenses.NO_LICENSE.toString()
  };

  info(`Verifying ${contractName} at ${address} with compiler version ${compilerVersion}...`, verbose);
  debug(`Etherscan API Request:\n\n${JSON.stringify(verifyData, undefined, 2)}`, verbose);
  debug(metadata.sources, verbose);

  // Potential results
  // {"status":"0","message":"NOTOK","result":"Invalid constructor arguments provided. Please verify that they are in ABI-encoded format"}
  // {"status":"1","message":"OK","result":"usjpiyvmxtgwyee59wnycyiet7m3dba4ccdi6acdp8eddlzdde"}

  let result: Result = <Result>await post(url, verifyData);

  if (Number(result.status) === 0 || result.message !== "OK") {
    if (result.result.includes('Contract source code already verified')) {
      warn(`Contract already verified`, verbose);
    } else {
      throw new Error(`Etherscan Error: ${result.message}: ${result.result}`)
    }
  } else {
    return await checkStatus(url, apiKey, result.result, verbose);
  }
}
