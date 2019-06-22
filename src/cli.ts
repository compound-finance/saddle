#!/usr/bin/env node

import yargs from 'yargs';
import {compile} from './cli/commands/compile';
import {deploy} from './cli/commands/deploy';
import {test} from './cli/commands/test';

yargs
  .option('network', {alias: 'n', description: 'Chosen network', type: 'string', default: 'development'})
  .count('verbose')
  .alias('v', 'verbose')
  .command('compile', 'Compiles all contracts', (yargs) => yargs, (argv) => {
    compile(argv.verbose)
  })
  .command('deploy <contract>', 'Deploy a contract to given network', (yargs) => {
    return yargs
      .positional('contract', {
        describe: 'Contract to deploy (e.g. myContract.sol)',
        type: 'string'
      });
  }, (argv) => {
    const contract: string = <string>argv.contract; // required
    const [,...contractArgs] = argv._;

    deploy(argv.network, contract, contractArgs, argv.verbose);
  })
  .command('test', 'Run contract tests', (yargs) => yargs, (argv) => {
    test(argv, argv.verbose);
  })
  .help()
  .alias('help', 'h')
  .parse();
