import Web3 from 'web3';

import { contractDeployInfo } from './contract';
import { info, debug, warn, error } from './logger';
import { describeProvider } from './utils';
import { diffStringsUnified } from 'jest-diff';
import { NetworkConfig } from './config';

export async function match(network_config: NetworkConfig, account: string, web3: Web3, address: string, contractName: string, contractArgs: string | any[], trace: boolean, verbose: number): Promise<void> {
  info(`Matching contract at ${address} to ${contractName} with args ${JSON.stringify(contractArgs)}`, verbose);

  const callOptions = {
    ...network_config.defaultOptions,
    from: account
  };

  let contractCode = await web3.eth.getCode(address);

  if (contractCode === '0x') {
    throw new Error(`Match Failed: No contract code found at ${address} on ${network_config.network}`);
  }

  let deploymentABI = await contractDeployInfo(web3, network_config.network, contractName, contractArgs, network_config, network_config.defaultOptions, callOptions);

  let expectedBytecode = await web3.eth.call({
    ...callOptions,
    to: undefined,
    data: deploymentABI
  });

  if (expectedBytecode === '0x') {
    throw new Error(`Match Failed: Contract "${contractName}" creation reverted on ${network_config.network}`);
  }

  if (expectedBytecode != contractCode) {
    error(diffStringsUnified(expectedBytecode, contractCode), verbose);

    throw new Error(`Match Failed: Mismatched bytecode`);
  }

  info(`✅ Successfully matched ${contractName} to ${address} with args ${JSON.stringify(contractArgs)}`, verbose);
}
