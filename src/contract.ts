import Web3 from 'web3';
import { Contract, SendOptions } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import ganache from 'ganache-core';
import { readFile, writeFile } from './file';
import { AbiItem } from 'web3-utils';
import * as path from 'path';
import { SaddleConfig, NetworkConfig } from './config';
import FastGlob from 'fast-glob';

interface ContractBuild {
  path: string
  version: string
  abi: string
  bin: string
  sources: {string: {content: string, keccak256: string}}
}

export function getBuildFile(saddle_config: SaddleConfig | NetworkConfig): string {
  if (saddle_config.get_build_file) {
    return saddle_config.get_build_file()
  } else {
    const fileName = saddle_config.trace ? `contracts-trace.json` : `contracts.json`;
    return path.join(path.resolve(process.cwd(), saddle_config.build_dir), fileName);
  }
}

export async function readBuildFile(saddle_config: SaddleConfig | NetworkConfig): Promise<object> {
  if (saddle_config.read_build_file) {
    return await saddle_config.read_build_file();
  } else {
    let buildFile = await getBuildFile(saddle_config);
    let initialBuild = await readFile(buildFile, {}, JSON.parse);
    let extraBuildFiles = await FastGlob(saddle_config.extra_build_files);

    return await extraBuildFiles.reduce(async (accP, el) => {
      let acc = await accP;
      let newBuild = await readFile(el, {}, JSON.parse);

      return {
        ...acc,
        contracts: {
          ...newBuild.contracts, // Note: we only merge in the sub-contracts
          ...acc.contracts
        }
      }
    }, Promise.resolve(initialBuild));
  }
}

export function getNetworkFile(network_config: NetworkConfig): string {
  if (network_config.get_network_file) {
    return network_config.get_network_file(network_config.network)
  } else {
    const fileName = network_config.trace ? `${network_config.network}-trace.json` : `${network_config.network}.json`;
    return path.join(path.resolve(process.cwd(), network_config.build_dir), fileName);
  }
}

export async function readNetworkFile(network_config: NetworkConfig): Promise<{[contract: string]: string | null}> {
  if (network_config.read_network_file) {
    return <{[contract: string]: string | null}>await network_config.read_network_file(network_config.network);
  } else {
    let networkFile = await getNetworkFile(network_config);
    return await readFile(networkFile, {}, JSON.parse);
  }
}

export async function writeNetworkFile(value: object, network_config: NetworkConfig): Promise<void> {
  if (network_config.write_network_file) {
    await network_config.write_network_file(network_config.network, value);
  } else {
    let networkFile = await getNetworkFile(network_config);
    await writeFile(networkFile, JSON.stringify(value, undefined, 2));
  }
}

export async function getContractBuild(name: string, saddle_config: SaddleConfig | NetworkConfig): Promise<ContractBuild> {
  let contracts = await readBuildFile(saddle_config);
  let contractsObject = contracts["contracts"] || {};
  let foundContract = Object.entries(contractsObject).find(([pathContractName, contract]) => {
    let [_, contractName] = pathContractName.split(":", 2);
    return contractName == name;
  });

  if (foundContract) {
    let [contractPath, contractBuild] = <[string, ContractBuild]>foundContract;
    contractBuild.path = contractPath.split(':')[0];
    contractBuild.version = <string>contracts["version"];

    return <ContractBuild>contractBuild;
  } else {
    throw new Error(`Cannot find contract \`${name}\` in build file \`${getBuildFile(saddle_config)}\`.`);
  }
}

export async function listContracts(network_config: NetworkConfig): Promise<{[contract: string]: string | null}> {
  let contractJson = await readBuildFile(network_config);
  let networkConfig = await readNetworkFile(network_config);

  let contractSub = contractJson['contracts'] || {};
  let contractKeys = Object.keys(contractSub)
  let contracts = contractKeys.map((k) => k.split(':')[1]);

  return contracts.reduce((acc, el) => {
    return {
      ...acc,
      [el]: networkConfig[el]
    };
  }, {});
}

export async function getContractABI(name: string, saddle_config: SaddleConfig | NetworkConfig): Promise<AbiItem[]> {
  const contractBuild = await getContractBuild(name, saddle_config);
  return typeof(contractBuild.abi) === 'string' ? JSON.parse(contractBuild.abi) : contractBuild.abi;
}

export async function getContract(web3: Web3, name: string, saddle_config: SaddleConfig | NetworkConfig, defaultOptions: SendOptions): Promise<Contract> {
  const contractAbi = await getContractABI(name, saddle_config);
  return <any>(new web3.eth.Contract(contractAbi, undefined, defaultOptions));
}

export async function getContractAt(web3: Web3, name: string, saddle_config: SaddleConfig | NetworkConfig, address: string, defaultOptions: SendOptions): Promise<Contract> {
  const contract = await getContract(web3, name, saddle_config, defaultOptions);
  contract.options.address = address;
  return contract;
}

export async function deployContract(web3: Web3, network: string, name: string, args: any[], network_config: NetworkConfig, defaultOptions: SendOptions, sendOptions: SendOptions): Promise<{contract: Contract, receipt: TransactionReceipt}> {
  const contractBuild = await getContractBuild(name, network_config);
  const web3Contract = await getContract(web3, name, network_config, defaultOptions);

  const deployer = await web3Contract.deploy({ data: '0x' + contractBuild.bin, arguments: args });
  let receiptResolveFn;
  let receiptPromise = <Promise<TransactionReceipt>>new Promise((resolve, reject) => {
    receiptResolveFn = resolve;
  });

  let deployment = deployer.send(sendOptions).on('receipt', (receipt) => {
    return receiptResolveFn(receipt);
  });

  return {
    contract: await deployment,
    receipt: await receiptPromise
  };
}

function strip0x(str) {
  if (str.slice(0,2) === "0x") {
    return str.slice(2,);
  } else {
    return str;
  }
}

export async function contractDeployInfo(web3: Web3, network: string, name: string, args: string | any[], network_config: NetworkConfig, defaultOptions: SendOptions, sendOptions: SendOptions): Promise<string> {
  const contractBuild = await getContractBuild(name, network_config);
  const web3Contract = await getContract(web3, name, network_config, defaultOptions);

  if (Array.isArray(args)) {
    const deployer = await web3Contract.deploy({ data: '0x' + contractBuild.bin, arguments: args });

    return deployer.encodeABI();
  } else {
    return '0x' + contractBuild.bin + strip0x(args);
  }
}

export async function saveContract(name: string, contract: Contract, network_config: NetworkConfig): Promise<void> {
  let curr = await readNetworkFile(network_config);

  curr[name] = contract.options.address;

  await writeNetworkFile(curr, network_config);
}

export async function loadContractAddress(name: string, network_config: NetworkConfig): Promise<string | undefined> {
  let curr = await readNetworkFile(network_config);

  return curr[name] || undefined;
}
