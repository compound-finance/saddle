import repl from 'repl';
import { getSaddle } from '../../saddle';
import { getCli } from '../../cli';

import { info, debug, warn, error } from '../logger';
import { describeProvider } from '../../utils';

function lowerCase(str) {
  if (str === "") {
    return "";
  } else {
    return str[0].toLowerCase() + str.slice(1,);
  }
}

function addCommands(r, saddle, network, contracts) {
  r.defineCommand('deploy', {
    help: 'Deploy a given contract',
    action(name) {
      this.clearBufferedCommand();
      let that = this;

      getCli().parse(`deploy ${name}`, function (err, argv, output) {
        if (err) {
          console.error(`Error: ${err}`);
        } else {
          console.log(output);
          argv.deployedResult.then((res) => {
            saddle.listContracts().then((contracts) => {
              defineContracts(r, saddle, contracts);
              addCommands(r, saddle, network, contracts);

              that.displayPrompt();
            });
          });
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

  r.defineCommand('contracts', {
    help: 'Show given contracts',
    action(name) {
      this.clearBufferedCommand();
      Object.entries(contracts).forEach(([contract, deployed]) => {
        console.log(`${contract}: ${deployed || ""}`);
      });
      this.displayPrompt();
    }
  });
}

function defineContracts(r, saddle, contracts) {
  Object.entries(contracts).forEach(([contract, address]) => {
    if (address) {
      saddle.getContractAt(contract, address).then((contractValue) => {
        Object.defineProperty(r.context, lowerCase(contract), {
          configurable: true,
          enumerable: true,
          value: contractValue
        });
      });
    }
  });
}

export async function startConsole(network: string, trace: boolean, verbose: number): Promise<void> {
  let saddle = await getSaddle(network);
  let contracts = await saddle.listContracts();

  info(`Saddle console on network ${network} ${describeProvider(saddle.web3.currentProvider)}${trace ? ' (Trace)' : ''}`, verbose);
  info(`Deployed ${network} contracts`, verbose);

  let r = repl.start('> ');

  Object.entries(contracts).forEach(([contract, deployed]) => {
    if (deployed) {
      console.log(`\t${lowerCase(contract)}: ${deployed}`);
    }
    r.context[contract] = contract; // Make strings known
  });

  addCommands(r, saddle, network, contracts);

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

  defineContracts(r, saddle, contracts);

  process.on('uncaughtException', () => console.log('Error'));
}
