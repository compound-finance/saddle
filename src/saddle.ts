import Web3 from 'web3';
import { loadConfig, instantiateConfig, NetworkConfig, SaddleConfig } from './config';
import { deployContract, getContract, getContractABI, getContractAt, listContracts, readNetworkFile } from './contract';
import { AbiItem } from 'web3-utils';
import { Contract, SendOptions } from 'web3-eth-contract';
import { describeProvider } from './utils';
import { TransactionReceipt } from 'web3-core';
import { buildTracer, TraceOptions } from './trace';
import { etherscanVerify } from './verify';
import { match } from './match';

export interface Saddle {
  account: string,
  accounts: string[],
  wallet_accounts: string[],
  saddle_config: SaddleConfig
  network_config: NetworkConfig
  getContract: (contractName: string, sendOptions: SendOptions) => Promise<Contract>
  getContractAt: (contractName: string, address: string) => Promise<Contract>
  listContracts: (all?: boolean) => Promise<{[contract: string]: string | null}>
  deploy: (contract: string, args: any[], sendOptions: any) => Promise<Contract>
  deployFull: (contract: string, args: any[], sendOptions: any, web3?: Web3 | undefined) => Promise<{contract: Contract, receipt: TransactionReceipt}>
  verify: (apiKey: string, address: string, contractName: string, contractArgs: (string | string[])[], optimizations: number) => Promise<void>
  match: (address: string, contractName: string, contractArgs: string | any[]) => Promise<void>
  abi: (contract: string) => Promise<AbiItem[]>
  web3: Web3
  send: (contract: Contract, method: string, args: any[], sendOptions?: SendOptions) => Promise<any>
  call: (contract: Contract, method: string, args: any[], sendOptions?: SendOptions) => Promise<any>
  trace: (receipt: TransactionReceipt, options: TraceOptions) => Promise<any>
}

function allowUndefinedArgs(args: any[] | SendOptions, sendOptions?: SendOptions): [any[], SendOptions | undefined] {
  if (!Array.isArray(args)) {
    if (sendOptions !== undefined) {
      throw new Error(`Args expected to be an array, got ${args}`);
    }
    return [[], args];
  } else {
    return [args, sendOptions]
  }
}

export async function getSaddle(network, trace=false, quiet=false): Promise<Saddle> {
  const saddle_config = await loadConfig(undefined, trace);
  const network_config = await instantiateConfig(saddle_config, network);
  if (!quiet) {
    console.log(`Using network ${network} ${describeProvider(network_config.web3.currentProvider)}`);
  }

  async function getContractInt(contractName: string, sendOptions?: SendOptions): Promise<Contract> {
    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await getContract(network_config.web3, contractName, network_config, options);
  }

  async function getContractAtInt(contractName: string, address: string): Promise<Contract> {
    return await getContractAt(network_config.web3, contractName, network_config, address, network_config.defaultOptions);
  }

  async function listContractsInt(all=false): Promise<{[contract: string]: string | null}> {
    if (all) {
      return await readNetworkFile(network_config);
    } else {
      return await listContracts(network_config);
    }
  }

  async function deploy(contractName: string, args: any[] | SendOptions=[], sendOptions?: SendOptions): Promise<Contract> {
    [args, sendOptions] = allowUndefinedArgs(args, sendOptions);

    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    let { contract: contract } = await deployContract(network_config.web3, network_config.network, contractName, args, network_config, network_config.defaultOptions, options);

    return contract;
  }

  async function deployFull(contractName: string, args: any[] | SendOptions=[], sendOptions?: SendOptions, web3?: Web3 | undefined): Promise<{contract: Contract, receipt: TransactionReceipt}> {
    [args, sendOptions] = allowUndefinedArgs(args, sendOptions);

    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return await deployContract(web3 || network_config.web3, network_config.network, contractName, args, network_config, network_config.defaultOptions, options);
  }

  async function verify(apiKey: string, address: string, contractName: string, contractArgs: (string | string[])[], verbose=0): Promise<void> {
    return await etherscanVerify(saddle_config, network, apiKey, address, contractName, contractArgs, verbose);
  }

  async function matchInt(address: string, contractName: string, contractArgs: string | any[], verbose=0): Promise<void> {
    return await match(network_config, network_config.default_account, network_config.web3, address, contractName, contractArgs, false, 0);
  }

  async function call(contract: Contract, method: string, args: any[] | SendOptions=[], callOptions?: SendOptions, blockNumber?: number): Promise<any> {
    [args, callOptions] = allowUndefinedArgs(args, callOptions);

    let options = {
      ...network_config.defaultOptions,
      ...callOptions
    };

    return contract.methods[method](...args).call(options, blockNumber || null);
  }

  async function send(contract: Contract, method: string, args: any[] | SendOptions=[], sendOptions?: SendOptions): Promise<any> {
    [args, sendOptions] = allowUndefinedArgs(args, sendOptions);

    let options = {
      ...network_config.defaultOptions,
      ...sendOptions
    };

    return contract.methods[method](...args).send(options);
  }

  async function abi(contract: string): Promise<AbiItem[]> {
    return await getContractABI(contract, network_config);
  }

  return {
    account: network_config.default_account,
    accounts: await network_config.web3.eth.getAccounts(),
    wallet_accounts: network_config.wallet_accounts,
    saddle_config: saddle_config,
    network_config: network_config,
    deploy: deploy,
    verify: verify,
    match: matchInt,
    deployFull: deployFull,
    abi: abi,
    web3: network_config.web3,
    send: send,
    call: call,
    getContract: getContractInt,
    getContractAt: getContractAtInt,
    listContracts: listContractsInt,
    trace: await buildTracer(network_config)
  };
}
