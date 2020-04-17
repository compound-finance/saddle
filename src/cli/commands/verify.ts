import * as fs from 'fs';
import * as path from 'path';
import {
  getContractBuild,
  loadContractAddress
} from '../../contract';
import AbiCoder from 'web3-eth-abi';
import { info, debug, warn, error } from '../logger';
import { getSaddle } from '../../saddle';
import { Result, getEtherscanApiUrl, get, post } from './etherscan';

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

const importRegex = /^[ \t]*import\s*\"([^\"]+)\"[\s;]*$\n?/mig;
const pragmaRegex = /^[ \t]*(pragma[^;]+;)$\n?/mig;

function matchAll(content, regex, index=1): string[] {
  const results: string[] = [];
  while (true) {
    let match = regex.exec(content)
    if (!match) {
      break;
    }
    results.push(index ? match[index] : match);
  }

  return results;
}

function orderEntries(sources: {string: {content: string}}) {
  const entries = Object.entries(sources);

  const deps = entries.reduce((acc, [name, {content: content}]) => {
    const entryDeps = matchAll(content, importRegex, 1)
                        .map(file => path.join(path.dirname(name), file));
    return {
      ...acc,
      [name]: entryDeps
    };
  }, {});

  function addDeps(includedDeps: string[], totalDeps: object) {
    if (Object.keys(totalDeps).length === 0) {
      return includedDeps;
    }

    const originalLength = includedDeps.length;

    Object.entries(totalDeps).forEach(([name, deps]) => {
      const sat = deps.every((dep) => includedDeps.includes(dep));

      if (sat) {
        includedDeps.push(name);
        delete totalDeps[name];
      }
    });

    if (includedDeps.length === originalLength) {
      throw new Error(`Cannot satisify dependency tree: included: ${JSON.stringify(includedDeps)}, total: ${JSON.stringify(totalDeps)}`);
    }

    return addDeps(includedDeps, totalDeps);
  }

  const order = addDeps([], deps);

  return order.map((el) => [el, sources[el]]);
}

function flattenSources(sources: {string: {content: string}}, contractName: string): string {
  const flattened = orderEntries(sources).reduce((acc, [name, {content: content}]) => {
    return acc + content.replace(importRegex, '');
  }, '');

  const pragmas = matchAll(flattened, pragmaRegex, 1);
  const pragmaHeader = [...new Set(pragmas)].join("\n");

  return pragmaHeader + "\n" + flattened.replace(pragmaRegex, '');
}

function getConstructorABI(abi: {type: string, inputs: any[]}[], contractArgs: (string|string[])[]): string {
  const constructorAbi = abi.find((x) => x.type === 'constructor');

  if (!constructorAbi) {
    return "0x";
  } else {
    return (<any>AbiCoder).encodeParameters(constructorAbi.inputs, contractArgs);
  }
}

export async function etherscanVerify(network: string, apiKey: string, contractName: string, contractArgs: string | any[], optimizations: number, source: string | undefined, verbose: number): Promise<void> {
  info(`Verifying contract ${contractName}${source ? ` from ${source}`: ""} with args ${JSON.stringify(contractArgs)}`, verbose);

  let saddle = await getSaddle(network);

  let contractAddress = await loadContractAddress(contractName, saddle.network_config);
  if (!contractAddress) {
    throw new Error(`Cannot find contract ${contractName}- was it deployed to ${network}?`);
  }
  let contractSource = source || contractName;
  let contractBuild = await getContractBuild(contractSource, saddle.saddle_config);
  let metadata = JSON.parse((<any>contractBuild).metadata);
  let sourceCode: string = await flattenSources(metadata.sources, contractName);
  let compilerVersion: string = contractBuild.version.replace(/(\.Emscripten)|(\.clang)|(\.Darwin)|(\.appleclang)/gi, '');
  let constructorAbi = Array.isArray(contractArgs) ? getConstructorABI(JSON.parse(contractBuild.abi), contractArgs) : contractArgs;
  let url = getEtherscanApiUrl(network);

  const verifyData: object = {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: sourceCode,
    contractname: contractName,
    compilerversion: `v${compilerVersion}`,
    optimizationUsed: optimizations > 0 ? '1' : '0',
    runs: optimizations > 0 ? optimizations.toString() : '',
    constructorArguements: constructorAbi.slice(2)
  };

  info(`Verifying ${contractName} at ${contractAddress} with compiler version ${compilerVersion}...`, verbose);
  debug(`Etherscan API Request:\n\n${JSON.stringify(verifyData, undefined, 2)}`, verbose);
  debug(sourceCode, verbose);

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
    return await checkStatus(url, result.result, verbose);
  }
}
