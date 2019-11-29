import {promisify} from 'util';
import {exec} from 'child_process';
import {loadConfig} from '../../config';
import {mkdirp, writeFile} from '../../file';

import {info, debug, warn, error} from '../logger';

export async function compile(verbose: number): Promise<void> {
  let config = await loadConfig();

  const buildDir = config.build_dir;
  const outFile = `${buildDir}/contracts.json`;
  const solc = `${config.solc} --combined-json bin,abi --optimize ${config.solc_args.join(" ")} ${config.contracts}`;

  info(`Compiling contracts ${config.contracts} with ${config.solc} to ${outFile}...`, verbose);
  debug(`Running \`${solc}\``, verbose)

  await mkdirp(buildDir);
  const { stdout, stderr } = await promisify(exec)(solc, config.solc_shell_args);

  if (stderr) {
    error(stderr, verbose);
  }

  await writeFile(outFile, stdout);

  info(`Contracts compiled successfully.`, verbose);
}
