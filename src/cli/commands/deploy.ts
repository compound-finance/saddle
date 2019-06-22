import {loadConfig, loadWeb3, loadAccount} from '../../config';
import {deployContract, saveContract} from '../../contract';

import {info, debug, warn, error} from '../logger';

export async function deploy(network: string, contractName: string, contractArgs: string[], verbose: number): Promise<void> {
  let config = await loadConfig(network);
  let web3 = await loadWeb3(config);

  info(`Using network ${network} ${web3.currentProvider.host}`, verbose);

  let account = await loadAccount(config, web3);
  info(`Deploying contract ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  let contract = await deployContract(web3, config.network, account, contractName, contractArgs);
  await saveContract(contractName, contract, config.network);

  info(`Deployed ${contractName} at ${contract.address}`, verbose);
}
