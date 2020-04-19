import { Contract } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import { deployContract, getNetworkFile, saveContract } from '../../contract';
import { getSaddle } from '../../saddle';

import { info, debug, warn, error } from '../../logger';
import { describeProvider } from '../../utils';

export async function deploy(network: string, contractName: string, contractArgs: any[], trace: boolean, verbose: number): Promise<{contract: Contract, receipt: TransactionReceipt}> {
  let saddle = await getSaddle(network);

  info(`Deploying contract ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  const sendOptions = {
    ...saddle.network_config.defaultOptions,
    from: saddle.account
  };
  let {contract, receipt} = await deployContract(saddle.web3, network, contractName, contractArgs, saddle.network_config, saddle.network_config.defaultOptions, sendOptions);

  info(`Deployed ${contractName} at ${contract.options.address}`, verbose);

  await saveContract(contractName, contract, saddle.network_config);

  info(`\nNote: see ${getNetworkFile(saddle.network_config)} for deployed contract addresses`, verbose);

  return {contract, receipt};
}
