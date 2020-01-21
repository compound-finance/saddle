import { Contract } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import { deployContract, saveContract } from '../../contract';
import { getSaddle } from '../../saddle';

import { info, debug, warn, error } from '../logger';
import { describeProvider } from '../../utils';

export async function deploy(network: string, contractName: string, contractArgs: any[], trace: boolean, verbose: number): Promise<{contract: Contract, receipt: TransactionReceipt}> {
  let saddle = await getSaddle(network);

  info(`Using network ${network} ${describeProvider(saddle.web3.currentProvider)}`, verbose);
  info(`Deploying contract ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  const sendOptions = {
    ...saddle.network_config.defaultOptions,
    from: saddle.account
  };
  let {contract, receipt} = await deployContract(saddle.web3, network, contractName, contractArgs, trace, saddle.network_config.defaultOptions, sendOptions);

  await saveContract(contractName, contract, network);

  info(`Deployed ${contractName} at ${contract.options.address}`, verbose);
  info(`\nNote: see ${saddle.network_config.build_dir}/${network}.json for deployed contract addresses`, verbose);

  return {contract, receipt};
}
