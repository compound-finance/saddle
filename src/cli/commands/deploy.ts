import {deployContract, saveContract} from '../../contract';
import {getSaddle} from '../../saddle';

import {info, debug, warn, error} from '../logger';

export async function deploy(network: string, contractName: string, contractArgs: string[], verbose: number): Promise<void> {

  let saddle = await getSaddle(network);

  info(`Using network ${network} ${saddle.web3.currentProvider.host}`, verbose);
  info(`Deploying contract ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  let contract = await deployContract(saddle.web3, network, contractName, contractArgs, {from: saddle.account});

  await saveContract(contractName, contract, network);

  info(`Deployed ${contractName} at ${contract.address}`, verbose);
  info(`\nNote: see ${saddle.config.build_dir}/${network}.json for deployed contract addresses`, verbose);
}
