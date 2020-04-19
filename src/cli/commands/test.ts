import yargs from 'yargs';
import cli from 'jest-cli';
import {buildArgv} from 'jest-cli/build/cli';
import jest from 'jest';
import path from 'path';
import {loadConfig} from '../../config';

import {info, debug, warn, error} from '../../logger';

export async function test(argv: yargs.Arguments, coverage: boolean, verbose: number): Promise<void> {
  info(`Saddle: running contract ${coverage ? 'coverage' : 'tests'} with jest...\n`, verbose);

  // Parse the saddle config
  const config = await loadConfig();

  if (argv._[0] == 'coverage') {
    argv._[0] = 'test';
  }

  // Parse command line args, possibly override testMatch based on remaining argv
  const jestArgv = buildArgv(argv._);
  const testArgs = argv._[0] == 'test' ? argv._.slice(1) : argv._;
  const testPats = testArgs.map(a => `**/${a}`);

  info(`Jest args: ${JSON.stringify(jestArgv)}`, verbose);

  const res = await jest.runCLI({
    testMatch: testPats.length ? testPats : config.tests,
    testEnvironment: path.join(__dirname, '..', '..', 'test_env.js'),
    testEnvironmentOptions: { coverage: coverage.toString() },
    ...jestArgv
  }, [process.cwd()]);

  if (!res.results.success) {
    process.exitCode = 1;
  }
}
