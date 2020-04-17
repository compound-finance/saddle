import util from 'util';
import vm from 'vm';

import { readFile } from '../../file';
import { getSaddle } from '../../saddle';
import { getContracts } from './console';

import { info, debug, warn, error } from '../logger';
import { describeProvider } from '../../utils';

export async function runScript(network: string, script: string, scriptArgs: any[], verbose: number): Promise<any> {
  let saddle = await getSaddle(network);
  let {contracts, contractInsts} = await getContracts(saddle);
  let contractAddresses = Object.fromEntries(
    Object.entries(contracts).map(([contract, address]) => {
      return [`$${contract}`, address];
    }));

  info(`Running script ${script} on network ${network} ${describeProvider(saddle.web3.currentProvider)} with args ${JSON.stringify(scriptArgs)}`, verbose);

  const context = {
    saddle,
    ...saddle,
    ...contractInsts,
    addresses: contracts,
    ...contractAddresses,
    console,
    network,
    args: scriptArgs
  };

  let scriptFile = saddle.saddle_config.scripts[script] || script; 
  const scriptContents = await readFile(scriptFile, null, (x) => x.toString());
  if (!scriptContents) {
    throw new Error(`Script not found: ${scriptFile}`);
  }

  const vmScript = new vm.Script(scriptContents);

  vm.createContext(context);

  let start = +new Date();
  let result = await vmScript.runInContext(context);
  let end = +new Date();

  info(`Script finished in ${end - start}ms.`, verbose);
  if (result) {
    debug("Script Result:", verbose);
    debug(result, verbose);
  }

  return result;
}
