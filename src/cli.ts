#!/usr/bin/env node

import yargs from 'yargs';
import { compile } from './cli/commands/compile';
import { startConsole } from './cli/commands/console';
import { listContracts } from './cli/commands/contracts';
import { loadContract } from './cli/commands/import';
import { deploy } from './cli/commands/deploy';
import { match } from './cli/commands/match';
import { verify } from './cli/commands/verify';
import { init } from './cli/commands/init';
import { test } from './cli/commands/test';
import { runScript } from './cli/commands/script';
export { getSaddle, Saddle } from './saddle';
import { isValidJSONString } from './utils';
import { Readable } from 'stream';
import { createReadStream } from 'fs';

function transformArgs(contractArgsRaw) {
  const transformers = {
    array: (arg) => arg.split(',').filter(x => x.length > 0),
    address: (arg) => arg.toString(),
    json: (arg) => JSON.parse(arg)
  };

  return contractArgsRaw.map((arg) => {
    // Check if arg is valid json string - tuple or an array of tuples,
    // otherwise split based on the last occurance of ':'
    let [raw, type] = isValidJSONString(arg) ? [arg, 'json'] : arg.toString().split(/\:(?=[^\:]+$)/);

    if (!type) {
      if (Number.isInteger(arg)) {
        type = 'number';
      } else if (arg.includes(',')) {
        type = 'array';
      }
    }

    if (type && transformers[type]) {
      return transformers[type](raw);
    } else {
      return arg;
    }
  });
}

export function getCli() {
  return yargs
    .option('network', {alias: 'n', description: 'Chosen network', type: 'string', default: 'development'})
    .count('verbose')
    .alias('v', 'verbose')
    .command('compile', 'Compiles all contracts', (yargs) => {
      return yargs
        .option('trace', {
          describe: 'Build contracts with detailed debug information',
          type: 'boolean',
          default: false
        })
        .option('pretty', {
          describe: 'Pretty format the JSON',
          type: 'boolean',
          default: true
        });
    }, (argv) => {
      argv.compileResult = compile(argv.trace, argv.verbose, argv.pretty);
    })
    .command('console', 'Starts a saddle console', (yargs) => {
      return yargs
        .option('trace', {
          describe: 'Build contracts with detailed debug information',
          type: 'boolean',
          default: false
        })
        .option('script', {
          describe: 'Run a given script instead of start a console',
          type: 'string',
          default: null,
          alias: 's'
        })
        .option('eval', {
          describe: 'Evaluate the given JavaScript code',
          type: 'string',
          default: null,
          alias: 'e'
        });
    }, (argv) => {
      let scriptArg: string | null = argv.script;
      let evalArg: string | string[] | null = <string | string[] | null>argv.eval;

      if (scriptArg && evalArg) {
        throw new Error("Cannot use --eval and --script options together");
      }

      let input: Readable | undefined;
      if (scriptArg !== null) {
        input = createReadStream(scriptArg);
      } else if (evalArg !== null) {
        let codes: string[] = Array.isArray(evalArg) ? evalArg.map((e) => e + ';\n') : [ evalArg ];
        input = Readable.from(codes);
      }

      startConsole(input, argv.network, argv.trace, argv.verbose);
    })
    .command('contracts', 'Display given contracts', (yargs) => yargs, (argv) => {
      argv.contractsResult = listContracts(argv.network);
    })
    .command('script <script>', 'Run a given script', (yargs) => {
      return yargs
        .positional('script', {
          describe: 'Script to run',
          type: 'string'
        });
    }, (argv) => {
      const script: string = <string>argv.script; // required

      argv.scriptResult = runScript(argv.network, script, argv._.slice(1), argv.verbose);
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

      argv.deployResult = deploy(argv.network, contract, contractArgs, false, argv.verbose);
    })
    .command('match <address> <contract>', 'Checks if a contract matches current build', (yargs) => {
      return yargs
        .positional('address', {
          describe: 'Address of on-chain contract to match',
          type: 'string'
        }).positional('contract', {
          describe: 'Contract to match (e.g. myContract.sol)',
          type: 'string'
        }).option('raw', {
          alias: 'r',
          describe: 'Args should be passed-through without transformation',
          type: 'boolean',
          default: false
        });
    }, (argv) => {
      const address: string = <string>argv.address; // required
      const contract: string = <string>argv.contract; // required
      const [,...contractArgsRaw] = argv._;
      const contractArgs = argv.raw ? argv._[1] : transformArgs(contractArgsRaw);

      argv.matchResult = match(argv.network, address, contract, contractArgs, false, argv.verbose);
    })
    .command('import <address>', 'Imports a contract from remote source', (yargs) => {
      return yargs
        .positional('address', {
          describe: 'Address of contract to read',
          type: 'string'
        })
        .option('source', {
          describe: 'Source to load contract from (e.g. etherscan)',
          type: 'string',
          default: 'etherscan'
        })
        .option('outdir', {
          describe: 'Directory to place build file',
          type: 'string',
          default: './remote'
        });
    }, (argv) => {
      const address: string = <string>argv.address; // required

      loadContract(argv.source, argv.network, address, argv.outdir, argv.verbose);
    })
    .command('verify <apiKey> <address> <contract>', 'Verify a given contract on Etherscan', (yargs) => {
      return yargs
        .positional('apiKey', {
          describe: 'API Key from Etherscan',
          type: 'string'
        })
        .positional('address', {
          describe: 'Address of contract to verify',
          type: 'string'
        })
        .positional('contract', {
          describe: 'Contract to deploy (e.g. myContract.sol)',
          type: 'string'
        })
        .option('raw', {
          alias: 'r',
          describe: 'Args should be passed-through without transformation',
          type: 'boolean',
          default: false
        });
    }, (argv) => {
      const apiKey: string = <string>argv.apiKey; // required
      const address: string = <string>argv.address; // required
      const contract: string = <string>argv.contract; // required
      const [,...contractArgsRaw] = argv._;
      const contractArgs = argv.raw ? argv._[1] : transformArgs(contractArgsRaw);

      verify(argv.network, apiKey, address, contract, contractArgs, argv.verbose);
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
    .strict();
}

if (require.main === module) {
  getCli().parse();
}
