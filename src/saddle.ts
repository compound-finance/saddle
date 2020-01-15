import Web3 from 'web3';
import { loadConfig, instantiateConfig, NetworkConfig, SaddleConfig } from './config';
import { deployContract, getContract, getContractABI, getContractAt } from './contract';
import { AbiItem } from 'web3-utils';
import { Contract, SendOptions } from 'web3-eth-contract';
import { describeProvider } from './utils';
import { TransactionReceipt } from 'web3-core';
import { buildTracer, TraceOptions } from './trace';

export interface Saddle {
  account: string,
  accounts: string[]
  saddle_config: SaddleConfig
  network_config: NetworkConfig
  getContract: (contractName: string, sendOptions: SendOptions) => Promise<Contract>
  getContractAt: (contractName: string, address: string) => Promise<Contract>
  deploy: (contract: string, args: any[], sendOptions: any) => Promise<Contract>
  deployFull: (contract: string, args: any[], sendOptions: any, web3?: Web3 | undefined) => Promise<{contract: Contract, receipt: TransactionReceipt}>
  abi: (contract: string) => Promise<AbiItem[]>
  web3: Web3
  send: (contract: Contract, method: string, args: any[], sendOptions?: SendOptions) => Promise<any>
  call: (contract: Contract, method: string, args: any[], sendOptions?: SendOptions) => Promise<any>
  trace: (receipt: TransactionReceipt, options: TraceOptions) => Promise<any>
}

export async function getSaddle(network, trace=false): Promise<Saddle> {
  const saddle_config = await loadConfig(undefined, trace);
  const network_config = await instantiateConfig(saddle_config, network);
  console.log(`Using network ${network} ${describeProvider(network_config.web3.currentProvider)}`);

  async function getContractInt(contractName: string, sendOptions?: SendOptions): Promise<Contract> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await getContract(network_config.web3, contractName, saddle_config.trace, options);
  }

  async function getContractAtInt(contractName: string, address: string): Promise<Contract> {
    return await getContractAt(network_config.web3, contractName, saddle_config.trace, address, network_config.defaultOptions);
  }

  async function deploy(contractName: string, args: any[], sendOptions?: SendOptions): Promise<Contract> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    let { contract: contract } = await deployContract(network_config.web3, network_config.network, contractName, args, saddle_config.trace, network_config.defaultOptions, options);

    return contract;
  }

  async function deployFull(contractName: string, args: any[], sendOptions?: SendOptions, web3?: Web3 | undefined): Promise<{contract: Contract, receipt: TransactionReceipt}> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await deployContract(web3 || network_config.web3, network_config.network, contractName, args, saddle_config.trace, network_config.defaultOptions, options);
  }

  async function call(contract: Contract, method: string, args: any[], callOptions?: SendOptions, blockNumber?: number): Promise<any> {
    let options = {
      ...network_config.defaultOptions,
      ...callOptions
    };

    return contract.methods[method](...args).call(options, blockNumber || null);
  }

  async function send(contract: Contract, method: string, args: any[], sendOptions?: SendOptions): Promise<any> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return contract.methods[method](...args).send(options);
  }

  async function abi(contract: string): Promise<AbiItem[]> {
    return await getContractABI(contract, saddle_config.trace);
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
    getContractAt: getContractAtInt,
    trace: await buildTracer(network_config)
  };
}
