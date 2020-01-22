import Web3 from 'web3';
import { Contract, SendOptions } from 'web3-eth-contract';
import newContract from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import ganache from 'ganache-core';
import { readFile, writeFile } from './file';
import { AbiItem } from 'web3-utils';
import * as path from 'path';

interface ContractBuild {
  path: string
  version: string
  abi: string
  bin: string
  sources: {string: {content: string, keccak256: string}}
}

export function getBuildFile(build_dir: string, trace?: boolean): string {
  const fileName = trace ? `contract-trace.json` : `contract.json`;
  return path.join(path.resolve(process.cwd(), build_dir), fileName);
}

export function getNetworkFile(build_dir: string, network: string, trace?: boolean): string {
  const fileName = trace ? `${network}-trace.json` : `${network}.json`;
  return path.join(path.resolve(process.cwd(), build_dir), fileName);
}

export async function getContractBuild(name: string, build_dir: string, trace: boolean): Promise<ContractBuild> {
  let buildFile = getBuildFile(build_dir, trace);
  let contracts = await readFile(buildFile, {}, JSON.parse);
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
    throw new Error(`Cannot find contract \`${name}\` in build file \`${buildFile}\`.`);
  }
}

export async function getContractABI(name: string, build_dir: string, trace: boolean): Promise<AbiItem[]> {
  const contractBuild = await getContractBuild(name, build_dir, trace);
  return JSON.parse(contractBuild.abi);
}

export async function getContract(web3: Web3, name: string, build_dir: string, trace: boolean, defaultOptions: SendOptions): Promise<Contract> {
  const contractBuild = await getContractBuild(name, build_dir, trace);
  const contractAbi = JSON.parse(contractBuild.abi);
  (<any>newContract).setProvider((<any>web3).currentProvider);
  const contract = <Contract>(new (<any>newContract)(contractAbi));

  return contract;
}

export async function getContractAt(web3: Web3, name: string, build_dir: string, trace: boolean, address: string, defaultOptions: SendOptions): Promise<Contract> {
  const contract = await getContract(web3, name, build_dir, trace, defaultOptions);
  contract.options.address = address;
  return contract;
}

export async function deployContract(web3: Web3, network: string, name: string, args: any[], build_dir: string, trace: boolean, defaultOptions: SendOptions, sendOptions: SendOptions): Promise<{contract: Contract, receipt: TransactionReceipt}> {
  const contractBuild = await getContractBuild(name, build_dir, trace);
  const contractAbi = JSON.parse(contractBuild.abi);
  (<any>newContract).setProvider((<any>web3).currentProvider);
  const web3Contract = <Contract>(new (<any>newContract)(contractAbi, undefined, defaultOptions));

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

export async function saveContract(name: string, contract: Contract, build_dir: string, network: string, trace: boolean): Promise<void> {
  let file = getNetworkFile(build_dir, network, trace);
  let curr = await readFile(file, {}, JSON.parse);

  curr[name] = contract.options.address;

  await writeFile(file, JSON.stringify(curr, undefined, 2));
}

export async function loadContractAddress(name: string, build_dir: string, network: string, trace: boolean): Promise<string | undefined> {
  let file = getNetworkFile(build_dir, network, trace);
  let curr = await readFile(file, {}, JSON.parse);

  return curr[name];
}
