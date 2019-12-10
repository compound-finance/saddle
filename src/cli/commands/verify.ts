import request from 'request';
import * as fs from 'fs';
import * as path from 'path';
import {
  getContractBuild,
  loadContractAddress
} from '../../contract';
import Web3 from 'web3';
import {info, debug, warn, error} from '../logger';

interface DevDoc {
  author: string
  methods: object
  title: string
}

interface UserDoc {
  methods: object
  notice: string
}

function getUrl(network: string): string {
  let host = {
    kovan: 'api-kovan.etherscan.io',
    rinkeby: 'api-rinkeby.etherscan.io',
    ropsten: 'api-ropsten.etherscan.io',
    goerli: 'api-goerli.etherscan.io',
    mainnet: 'api.etherscan.io'
  }[network];

  if (!host) {
    throw new Error(`Unknown etherscan API host for network ${network}`);
  }

  return `https://${host}/api`;
}

function post(url, data): Promise<object> {
  return new Promise((resolve, reject) => {
    request.post(url, {form: data}, (err, httpResponse, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
}

function get(url, data): Promise<object> {
  return new Promise((resolve, reject) => {
    request.get(url, {form: data}, (err, httpResponse, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
}

interface Result {
  status: string
  message: string
  result: string
}

async function sleep(timeout): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(() => resolve(), timeout);
  })
}

async function checkStatus(url: string, token: string, verbose: number): Promise<void> {
  info(`Checking status of ${token}...`, verbose);

  // Potential results:
  // { status: '0', message: 'NOTOK', result: 'Fail - Unable to verify' }
  // { status: '0', message: 'NOTOK', result: 'Pending in queue' }
  // { status: '1', message: 'OK', result: 'Pass - Verified' }

  let result: Result = <Result>await get(url, {
    guid: token,
    module: "contract",
    action: "checkverifystatus"
  });

  info(JSON.stringify(result), verbose);

  if (result.result === "Pending in queue") {
    await sleep(5000);
    return await checkStatus(url, token, verbose);
  }

  if (result.result.startsWith('Fail')) {
    throw new Error(`Etherscan failed to verify contract: ${result.message} "${result.result}"`)
  }

  if (Number(result.status) !== 1) {
    throw new Error(`Etherscan Error: ${result.message} "${result.result}"`)
  }

  info(`Verification result ${result.result}...`, verbose);
}

function flattenSources(sources: {string: {content: string}}, contractName: string): string {
  return Object.entries(sources).reduce((acc, [name, {content: content}]) => {
    return acc + content.replace(/^\s+import [^\n]+$/mig, '');
  }, '');
}

function getConstructorABI(abi: {type: string, inputs: any[]}[], contractArgs: (string|string[])[]): string {
  const constructorAbi = abi.find((x) => x.type === 'constructor');
   let inputs;

  if (constructorAbi) {
    inputs = constructorAbi.inputs;
  } else {
    inputs = [];
  }

  return new Web3().eth.abi.encodeParameters(inputs, contractArgs);
}

export async function verify(network: string, apiKey: string, contractName: string, contractArgs: (string|string[])[], verbose: number): Promise<void> {
  info(`Verifying contract ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  console.log(contractName, network);
  let contractAddress = await loadContractAddress(contractName, network);
  if (!contractAddress) {
    throw new Error(`Cannot find contract ${contractName}`)
  }
  let contractBuild = await getContractBuild(contractName, false);
  let metadata = JSON.parse((<any>contractBuild).metadata);
  console.log(metadata.sources);
  let sourceCode: string = await flattenSources(metadata.sources, contractName);
  console.log(sourceCode);
  let compilerVersion: string = contractBuild.version.replace(/(\.Emscripten)|(\.clang)|(\.Darwin)|(\.appleclang)/gi, '');
  let constructorAbi = getConstructorABI(JSON.parse(contractBuild.abi), contractArgs);
  let url = getUrl(network);

  const verifyData: object = {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: sourceCode,
    contractname: contractName,
    compilerversion: `v${compilerVersion}`,
    optimizationUsed: '1',
    runs: '200',
    constructorArguements: constructorAbi.slice(2)
  };

  console.log(`Verifying ${contractName} at ${contractAddress} with compiler version ${compilerVersion}...`);

  // Potential results
  // {"status":"0","message":"NOTOK","result":"Invalid constructor arguments provided. Please verify that they are in ABI-encoded format"}
  // {"status":"1","message":"OK","result":"usjpiyvmxtgwyee59wnycyiet7m3dba4ccdi6acdp8eddlzdde"}

  let result: Result = <Result>await post(url, verifyData);

  if (Number(result.status) === 0 || result.message !== "OK") {
    if (result.result.includes('Contract source code already verified')) {
      console.log(`Contract already verified`);
    } else {
      throw new Error(`Etherscan Error: ${result.message}: ${result.result}`)
    }
  } else {
    return await checkStatus(url, result.result, verbose);
  }
}
