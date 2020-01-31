import { getSaddle } from '../../saddle';
import { AbiInput } from 'web3-utils';

export async function listContracts(network) {
  let saddle = await getSaddle(network);
  let contracts = await saddle.listContracts();
  let contractABI = await Object.entries(contracts).reduce(async (acc, [contract, address]) => {
    let abi = await saddle.abi(contract);
    let constructorABI = abi.find(({type}) => type === 'constructor');
    let inputs = constructorABI ? constructorABI.inputs : [];

    return {
      ...await acc,
      [contract]: inputs || []
    };
  }, <Promise<{[name: string]: AbiInput[]}>>{});

  console.log("Contracts:");
  Object.entries(contractABI).forEach(([contract, abiItem]) => {
    let args = abiItem.map(({name, type}) => `${name}:${type}`);
    console.log(`\t${contract} ${args.join(" ")}`)
  });
}
