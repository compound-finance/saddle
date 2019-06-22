import {loadConfig, instantiateConfig} from './config';
import {deployContract} from './contract';
import {Contract, SendOptions, CallOptions} from 'web3-eth-contract';

export async function getSaddle(network) {
  const config = await instantiateConfig(await loadConfig(), network);
  console.log(`Using network ${network} ${config.web3.currentProvider.host}`);

  async function deploy(contract: string, args: any[], sendOptions: SendOptions={}): Promise<Contract> {
    console.log(["Deploying", contract, args]);

    return deployContract(config.web3, config.network, contract, args, sendOptions);
  }

  async function call(callable, callOptions: CallOptions={}): Promise<any> {
    return callable.call(callOptions);
  }

  async function send(sendable, sendOptions: SendOptions={}): Promise<any> {
    return sendable.send(sendOptions);
  }

  return {
    account: config.account,
    accounts: await config.web3.eth.getAccounts(),
    config: config,
    deploy: deploy,
    web3: config.web3,
    send: send,
    call: call
  };
}