#!/usr/bin/env node

import yargs from 'yargs';
import {compile} from './cli/commands/compile';
import {deploy} from './cli/commands/deploy';
import {verify} from './cli/commands/verify';
import {init} from './cli/commands/init';
import {test} from './cli/commands/test';
export { getSaddle, Saddle } from './saddle';

function transformArgs(contractArgsRaw) {
  const transformers = {
    array: (arg) => arg.split(',').filter(x => x.length > 0)
  };

  return contractArgsRaw.map((arg) => {
    let [raw, type] = arg.split(':', 2);

    // Custom array type
    if (!type && arg.includes(',')) {
      type = 'array';
    }

    if (type && transformers[type]) {
      return transformers[type](raw);
    } else {
      return arg;
    }
  });
}

if (require.main === module) {
  yargs
    .option('network', {alias: 'n', description: 'Chosen network', type: 'string', default: 'development'})
    .count('verbose')
    .alias('v', 'verbose')
    .command('compile', 'Compiles all contracts', (yargs) => {
      return yargs
        .option('trace', {
          describe: 'Build contracts with detailed debug information',
          type: 'boolean',
          default: false
        });
    }, (argv) => {
      compile(argv.trace, argv.verbose)
    })
    .command('deploy <contract>', 'Deploy a contract to given network', (yargs) => {
      return yargs
        .positional('contract', {
          describe: 'Contract to deploy (e.g. myContract.sol)',
          type: 'string'
        });
    }, (argv) => {
      const contract: string = <string>argv.contract; // required
      const [,...contractArgsRaw] = argv._;
      const contractArgs = transformArgs(contractArgsRaw);

      deploy(argv.network, contract, contractArgs, false, argv.verbose);
    })
    .command('verify <apiKey> <contract>', 'Deploy a contract to given network', (yargs) => {
      return yargs
        .positional('apiKey', {
          describe: 'API Key from Etherscan',
          type: 'string'
        })
        .positional('contract', {
          describe: 'Contract to deploy (e.g. myContract.sol)',
          type: 'string'
        });
    }, (argv) => {
      const apiKey: string = <string>argv.apiKey; // required
      const contract: string = <string>argv.contract; // required
      const [,...contractArgsRaw] = argv._;
      const contractArgs = transformArgs(contractArgsRaw);

      verify(argv.network, apiKey, contract, contractArgs, argv.verbose);
    })
    .command('test', 'Run contract tests', (yargs) => yargs, (argv) => {
      test(argv, false, argv.verbose);
    })
    .command('coverage', 'Run contract coverage tests', (yargs) => yargs, (argv) => {
      test(argv, true, argv.verbose);
    })
    .command('init', 'Build initial configuration file', (yargs) => yargs, (argv) => {
      init(argv.verbose);
    })
    .help()
    .alias('help', 'h')
    .demandCommand()
    .recommendCommands()
    .strict()
    .parse();
}