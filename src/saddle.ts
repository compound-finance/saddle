import Web3 from 'web3';
import {loadConfig, instantiateConfig, NetworkConfig} from './config';
import {deployContract, getContract, getContractABI, getContractAt} from './contract';
import {ABIItem} from 'web3-utils';
import {Contract, SendOptions, CallOptions} from 'web3-eth-contract';
import {describeProvider} from './utils';
import { TransactionReceipt } from 'web3-eth';

export interface Saddle {
  account: string,
  accounts: string[],
  config: NetworkConfig
  getContract: (contractName: string, sendOptions: SendOptions) => Promise<Contract>
  getContractAt: (contractName: string, address: string) => Promise<Contract>
  deploy: (contract: string, args: any[], sendOptions: any) => Promise<Contract>
  deployFull: (contract: string, args: any[], sendOptions: any) => Promise<{contract: Contract, receipt: TransactionReceipt}>
  abi: (contract: string) => Promise<ABIItem[]>
  web3: Web3
  send: (sendable: any, sendOptions?: any) => Promise<any>
  call: (callable: any, callOptions?: any) => Promise<any>
}

export async function getSaddle(network, coverage=false): Promise<Saddle> {
  const general_config = await loadConfig(undefined, coverage);
  const config = await instantiateConfig(general_config, network);
  console.log(`Using network ${network} ${describeProvider(config.web3.currentProvider)}`);

  async function getContractInt(contractName: string, sendOptions: SendOptions={}): Promise<Contract> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    return await getContract(config.web3, contractName, general_config.coverage, options);
  }

  async function getContractAtInt(contractName: string, address: string): Promise<Contract> {
    return await getContractAt(config.web3, contractName, general_config.coverage, address, config.defaultOptions);
  }

  async function deploy(contractName: string, args: any[], sendOptions: SendOptions={}): Promise<Contract> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    let { contract: contract } = await deployContract(config.web3, config.network, contractName, args, general_config.coverage, config.defaultOptions, options);

    return contract;
  }

  async function deployFull(contractName: string, args: any[], sendOptions: SendOptions={}): Promise<{contract: Contract, receipt: TransactionReceipt}> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    return await deployContract(config.web3, config.network, contractName, args, general_config.coverage, config.defaultOptions, options);
  }

  async function call(callable, callOptions: CallOptions={}): Promise<any> {
    // Allow old-style sends for now
    if (callable.methods && callable.methods[callOptions]) {
      callable = callable.methods[callOptions].apply(callable, arguments[2]);
      callOptions = arguments[3];
    }

    let options = {
      ...config.defaultOptions,
      ...callOptions
    };

    return callable.call(options);
  }

  async function send(sendable, sendOptions: SendOptions={}): Promise<any> {
    // Allow old-style sends for now
    if (sendable.methods && sendable.methods[sendOptions]) {
      sendable = sendable.methods[sendOptions].apply(sendable, arguments[2]);
      sendOptions = arguments[3];
    }

    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    return sendable.send(options);
  }

  async function abi(contract: string): Promise<ABIItem[]> {
    return await getContractABI(contract, general_config.coverage);
  }

  return {
    account: config.account,
    accounts: await config.web3.eth.getAccounts(),
    config: config,
    deploy: deploy,
    deployFull: deployFull,
    abi: abi,
    web3: config.web3,
    send: send,
    call: call,
    getContract: getContractInt,
    getContractAt: getContractAtInt
  };
}
