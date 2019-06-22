import yargs from 'yargs';
import cli from 'jest-cli';
import {buildArgv} from 'jest-cli/build/cli';
import jest from 'jest';
import path from 'path';

import {info, debug, warn, error} from '../logger';

export async function test(argv: yargs.Arguments, verbose: number): Promise<void> {
  info(`running tests`, verbose);

  const jestArgv = buildArgv(argv._);

  await jest.runCLI({
    ...jestArgv,
    testMatch: ['**/tests/*.js'], // hmm?
    testEnvironment: path.join(__dirname, '..', '..', 'test_env.js')
  }, [process.cwd()]);
}
