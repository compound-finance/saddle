import Web3 from 'web3';
import {loadConfig, instantiateConfig, NetworkConfig, SaddleConfig} from './config';
import {deployContract, getContract, getContractABI, getContractAt} from './contract';
import {ABIItem} from 'web3-utils';
import {Contract, SendOptions, CallOptions} from 'web3-eth-contract';
import {describeProvider} from './utils';
import { TransactionReceipt } from 'web3-eth';

export interface Saddle {
  account: string,
  accounts: string[]
  saddle_config: SaddleConfig
  network_config: NetworkConfig
  getContract: (contractName: string, sendOptions: SendOptions) => Promise<Contract>
  getContractAt: (contractName: string, address: string) => Promise<Contract>
  deploy: (contract: string, args: any[], sendOptions: any) => Promise<Contract>
  deployFull: (contract: string, args: any[], sendOptions: any, web3?: Web3 | undefined) => Promise<{contract: Contract, receipt: TransactionReceipt}>
  abi: (contract: string) => Promise<ABIItem[]>
  web3: Web3
  send: (sendable: any, sendOptions?: any) => Promise<any>
  call: (callable: any, callOptions?: any) => Promise<any>
}

export async function getSaddle(network, coverage=false): Promise<Saddle> {
  const saddle_config = await loadConfig(undefined, coverage);
  const network_config = await instantiateConfig(saddle_config, network);
  console.log(`Using network ${network} ${describeProvider(network_config.web3.currentProvider)}`);

  async function getContractInt(contractName: string, sendOptions: SendOptions={}): Promise<Contract> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await getContract(network_config.web3, contractName, saddle_config.coverage, options);
  }

  async function getContractAtInt(contractName: string, address: string): Promise<Contract> {
    return await getContractAt(network_config.web3, contractName, saddle_config.coverage, address, network_config.defaultOptions);
  }

  async function deploy(contractName: string, args: any[], sendOptions: SendOptions={}): Promise<Contract> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    let { contract: contract } = await deployContract(network_config.web3, network_config.network, contractName, args, saddle_config.coverage, network_config.defaultOptions, options);

    return contract;
  }

  async function deployFull(contractName: string, args: any[], sendOptions: SendOptions={}, web3?: Web3 | undefined): Promise<{contract: Contract, receipt: TransactionReceipt}> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await deployContract(web3 || network_config.web3, network_config.network, contractName, args, saddle_config.coverage, network_config.defaultOptions, options);
  }

  async function call(callable, callOptions: CallOptions={}, blockNumber?: number): Promise<any> {
    // Allow old-style sends for now
    if (callable.methods && callable.methods[callOptions]) {
      callable = callable.methods[callOptions].apply(callable, arguments[2]);
      callOptions = arguments[3];
      blockNumber = arguments[4];
    }

    let options = {
      ...network_config.defaultOptions,
      ...callOptions
    };

    return callable.call(options, blockNumber);
  }

  async function send(sendable, sendOptions: SendOptions={}): Promise<any> {
    // Allow old-style sends for now
    if (sendable.methods && sendable.methods[sendOptions]) {
      sendable = sendable.methods[sendOptions].apply(sendable, arguments[2]);
      sendOptions = arguments[3];
    }

    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return sendable.send(options);
  }

  async function abi(contract: string): Promise<ABIItem[]> {
    return await getContractABI(contract, saddle_config.coverage);
  }

  return {
    account: network_config.account,
    accounts: await network_config.web3.eth.getAccounts(),
    saddle_config: saddle_config,
    network_config: network_config,
    deploy: deploy,
    deployFull: deployFull,
    abi: abi,
    web3: network_config.web3,
    send: send,
    call: call,
    getContract: getContractInt,
    getContractAt: getContractAtInt
  };
}
