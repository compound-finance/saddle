import Web3 from 'web3';
import {Contract, SendOptions} from 'web3-eth-contract';
import * as path from 'path';
import ganache from 'ganache-core';
import {readFile, writeFile} from './file';

const BUILD_FILE_NAME = 'contracts.json';

interface ContractBuild {
  abi: string
  bin: string
}

function getBuildFile(file: string): string {
  return path.join(process.cwd(), '.build', file);
}

async function getContractBuild(name: string): Promise<ContractBuild> {
  let contracts = await readFile(getBuildFile(BUILD_FILE_NAME), {}, JSON.parse);
  let contractsObject = contracts["contracts"] || {};

  let foundContract = Object.entries(contractsObject).find(([pathContractName, contract]) => {
    let [_, contractName] = pathContractName.split(":", 2);
    return contractName == name;
  });

  if (foundContract) {
    let [_, contractBuild] = foundContract;

    return <ContractBuild>contractBuild;
  } else {
    throw new Error(`Cannot find contract \`${name}\` in build folder.`);
  }
}

export async function getContract(web3: Web3, name: string): Promise<Contract> {
  const contractBuild = await getContractBuild(name);
  const contractAbi = JSON.parse(contractBuild.abi);
  const contract = new web3.eth.Contract(contractAbi);
  return contract;
}

export async function getContractAt(web3: Web3, name: string, address?: string): Promise<Contract> {
  const contract = await getContract(web3, name);
  contract.address = address;
  return contract;
}

export async function deployContract(web3: Web3, network: string, name: string, args: any[], sendOptions: SendOptions={}): Promise<Contract> {
  const contractBuild = await getContractBuild(name);
  const contractAbi = JSON.parse(contractBuild.abi);
  const contract = new web3.eth.Contract(contractAbi);
  return await contract.deploy({data: '0x' + contractBuild.bin, arguments: args}).send(sendOptions);
}

export async function saveContract(name: string, contract: Contract, network: string): Promise<void> {
  let file = getBuildFile(`${network}.json`);
  let curr = await readFile(file, {}, JSON.parse);

  curr[name] = contract.address;

  await writeFile(file, JSON.stringify(curr));
}
