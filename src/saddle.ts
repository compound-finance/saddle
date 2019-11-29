import Web3 from 'web3';
import {loadConfig, instantiateConfig, NetworkConfig} from './config';
import {deployContract, getContractABI} from './contract';
import {ABI} from 'web3-eth-abi';
import {Contract, SendOptions, CallOptions} from 'web3-eth-contract';
import {describeProvider} from './utils';
import { TransactionReceipt } from 'web3-eth';

export interface Saddle {
  account: string,
  accounts: string[],
  config: NetworkConfig
  deploy: (contract: string, args: any[], sendOptions: any) => Promise<Contract>
  deployFull: (contract: string, args: any[], sendOptions: any) => Promise<{contract: Contract, receipt: TransactionReceipt}>
  abi: (contract: string) => Promise<ABI[]>
  web3: Web3
  send: (sendable: any, sendOptions?: any) => Promise<any>
  call: (callable: any, callOptions?: any) => Promise<any>
}

export async function getSaddle(network): Promise<Saddle> {
  const config = await instantiateConfig(await loadConfig(), network);
  console.log(`Using network ${network} ${describeProvider(config.web3.currentProvider)}`);

  async function deploy(contractName: string, args: any[], sendOptions: SendOptions={}): Promise<Contract> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    let { contract: contract } = await deployContract(config.web3, config.network, contractName, args, config.defaultOptions, options);

    return contract;
  }

  async function deployFull(contractName: string, args: any[], sendOptions: SendOptions={}): Promise<{contract: Contract, receipt: TransactionReceipt}> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    return await deployContract(config.web3, config.network, contractName, args, config.defaultOptions, options);
  }

  async function call(callable, callOptions: CallOptions={}): Promise<any> {
    let options = {
      ...config.defaultOptions,
      ...callOptions
    };

    return callable.call(callOptions);
  }

  async function send(sendable, sendOptions: SendOptions={}): Promise<any> {
    let options = {
      ...config.defaultOptions,
      ...sendOptions
    };

    return sendable.send(sendOptions);
  }

  async function abi(contract: string): Promise<ABI[]> {
    return await getContractABI(contract);
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
    call: call
  };
}
