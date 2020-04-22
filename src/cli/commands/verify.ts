import * as fs from 'fs';
import * as path from 'path';
import {
  getContractBuild,
  loadContractAddress
} from '../../contract';
import AbiCoder from 'web3-eth-abi';
import { info, debug, warn, error } from '../../logger';
import { getSaddle } from '../../saddle';
import { etherscanVerify } from '../../verify';

export async function verify(network: string, apiKey: string, address: string, contractName: string, contractArgs: (string|string[])[], verbose: number): Promise<void> {
  info(`Verifying contract ${contractName} at ${address} with args ${JSON.stringify(contractArgs)}`, verbose);

  let saddle = await getSaddle(network);

  etherscanVerify(saddle.saddle_config, network, apiKey, address, contractName, contractArgs, verbose);
}
