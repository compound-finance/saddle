import { contractDeployInfo } from '../../contract';
import { getSaddle } from '../../saddle';

import { info, debug, warn, error } from '../../logger';
import { describeProvider } from '../../utils';

import { diffStringsUnified } from 'jest-diff';

export async function match(network: string, address: string, contractName: string, contractArgs: string | any[], trace: boolean, verbose: number): Promise<void> {
  let saddle = await getSaddle(network);

  info(`Matching contract at ${address} to ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  const callOptions = {
    ...saddle.network_config.defaultOptions,
    from: saddle.account
  };

  let contractCode = await saddle.web3.eth.getCode(address);

  if (contractCode === '0x') {
    throw new Error(`Match Failed: No contract code found at ${address} on ${network}`);
  }

  let deploymentABI = await contractDeployInfo(saddle.web3, network, contractName, contractArgs, saddle.network_config, saddle.network_config.defaultOptions, callOptions);

  let expectedBytecode = await saddle.web3.eth.call({
    ...callOptions,
    to: undefined,
    data: deploymentABI
  });

  if (expectedBytecode === '0x') {
    throw new Error(`Match Failed: Contract "${contractName}" creation reverted on ${network}`);
  }

  if (expectedBytecode != contractCode) {
    error(diffStringsUnified(expectedBytecode, contractCode), verbose);

    throw new Error(`Match Failed: Mismatched bytecode`);
  }

  info(`✅ Successfully matched ${contractName} to ${address} with args ${JSON.stringify(contractArgs)}`, verbose);
}
