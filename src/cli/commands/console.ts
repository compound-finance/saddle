import repl from 'repl';
import path from 'path';
import { getSaddle } from '../../saddle';
import { getCli } from '../../cli';
import { Contract } from 'web3-eth-contract';

import { info, debug, warn, error } from '../../logger';
import { describeProvider } from '../../utils';
import { getCompletions } from './console/completion';
import { Readable } from 'stream';

function lowerCase(str) {
  if (str === "") {
    return "";
  } else {
    return str[0].toLowerCase() + str.slice(1,);
  }
}

async function wrapError(p, that) {
  try {
    return await p;
  } catch (err) {
    console.error(`Error: ${err}`);
  } finally {
    that.displayPrompt();
  }
}

export async function getContracts(saddle) {
  let contracts = await saddle.listContracts();
  let contractInsts = await Object.entries(contracts).reduce(async (acc, [contract, address]) => {
    if (address) {
      return {
        ... await acc,
        [contract]: await saddle.getContractAt(contract, address)
      };
    } else {
      return await acc;
    }
  }, <Promise<{[name: string]: Contract}>>{});

  return {
    contracts,
    contractInsts
  }
}

function defineCommands(r, saddle, network, contracts) {
  r.defineCommand('deploy', {
    help: 'Deploy a given contract',
    action(...args) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`deploy -n ${network} ${args.join(" ")}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          wrapError(argv.deployResult, that).then((res) => {
            if (res) {
              getContracts(saddle).then(({contracts, contractInsts}) => {
                (<any>r).completer = getCompletions(r.originalCompleter, contracts);
                defineContracts(r, saddle, contractInsts);
                defineCommands(r, saddle, network, contracts);

                that.displayPrompt();
              });
            }
          });
        }
      });
    }
  });

  r.defineCommand('verify', {
    help: 'Verify a given contract on Etherscan',
    action(...args) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`verify -n ${network} ${args.join(" ")}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          wrapError(argv.verifyResult, that);
        }
      });
    }
  });

  r.defineCommand('match', {
    help: 'Matches a given contract to an Ethereum deploy contract',
    action(...args) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`match -n ${network} ${args.join(" ")}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          wrapError(argv.matchResult, that);
        }
      });
    }
  });

  r.defineCommand('compile', {
    help: 'Re-compile contracts',
    action(name) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`compile ${name}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          wrapError(argv.compileResult, that).then((res) => {
            if (res) {
              getContracts(saddle).then(({contracts, contractInsts}) => {
                (<any>r).completer = getCompletions(r.originalCompleter, contracts);
                defineContracts(r, saddle, contractInsts);
                defineCommands(r, saddle, network, contracts);

                that.displayPrompt();
              });
            }
          });
        }
      });
    }
  });

  r.defineCommand('contracts', {
    help: 'Lists known contracts',
    action(name) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`contracts ${name}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          wrapError(argv.contractsResult, that);
        }
      });
    }
  });

  r.defineCommand('network', {
    help: 'Show given network',
    action(name) {
      this.clearBufferedCommand();
      console.log(`Network: ${network}`);
      this.displayPrompt();
    }
  });

  r.defineCommand('provider', {
    help: 'Show given provider',
    action(name) {
      this.clearBufferedCommand();
      console.log(`Provider: ${describeProvider(saddle.web3.currentProvider)}`);
      this.displayPrompt();
    }
  });

  r.defineCommand('from', {
    help: 'Show default from address',
    action(name) {
      this.clearBufferedCommand();
      console.log(`From: ${saddle.network_config.default_account}`);
      this.displayPrompt();
    }
  });

  r.defineCommand('deployed', {
    help: 'Show given deployed contracts',
    action(name) {
      this.clearBufferedCommand();
      Object.entries(contracts).forEach(([contract, deployed]) => {
        console.log(`${contract}: ${deployed || ""}`);
      });
      this.displayPrompt();
    }
  });
}

function defineContracts(r, saddle, contractInsts) {
  Object.entries(contractInsts).forEach(([contract, contractInst]) => {
    Object.defineProperty(r.context, lowerCase(contract), {
      configurable: true,
      enumerable: true,
      value: contractInst
    });
  });
}

export async function startConsole(input: Readable | undefined, network: string, trace: boolean, verbose: number): Promise<void> {
  let saddle = await getSaddle(network);
  let {contracts, contractInsts} = await getContracts(saddle);

  info(`Saddle console on network ${network} ${describeProvider(saddle.web3.currentProvider)}${trace ? ' (Trace)' : ''}`, verbose);
  info(`Deployed ${network} contracts`, verbose);

  Object.entries(contracts).forEach(([contract, deployed]) => {
    if (deployed) {
      console.log(`\t${lowerCase(contract)}: ${deployed}`);
    }
  });

  let r = repl.start({
    prompt: '> ',
    input: input,
    output: input ? process.stdout : undefined,
    terminal: input ? false : undefined
  });
  if (typeof(r.setupHistory) === 'function') {
    r.setupHistory(path.join(process.cwd(), '.saddle_history'), (err, repl) => null);
  }
  (<any>r).originalCompleter = r.completer;
  (<any>r).completer = getCompletions(r.completer, contracts);

  defineCommands(r, saddle, network, contracts);

  Object.defineProperty(r.context, 'saddle', {
    configurable: false,
    enumerable: true,
    value: saddle
  });

  Object.keys(saddle).forEach((key) => {
    Object.defineProperty(r.context, key, {
      configurable: false,
      enumerable: typeof(saddle[key]) !== 'function',
      value: saddle[key]
    });
  });

  defineContracts(r, saddle, contractInsts);

  process.on('uncaughtException', () => console.log('Error'));
}
