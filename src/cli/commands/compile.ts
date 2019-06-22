import fs from 'fs';
import util from 'util';
import {exec} from 'child_process';
import {loadConfig} from '../../config';

import {info, debug, warn, error} from '../logger';

export async function compile(verbose: number): Promise<void> {
  let config = await loadConfig();

  const buildDir = config.build_dir;
  const outFile = `${buildDir}/contracts.json`;
  const solc = `${config.solc} --combined-json bin,abi --optimize ${config.solc_args.join(" ")} ${config.contracts}`;

  info(`Compiling contracts ${config.contracts} with ${config.solc} to ${outFile}...`, verbose);
  debug(`Running \`${solc}\``, verbose)

  await util.promisify(fs.mkdir)(buildDir, { recursive: true });
  const { stdout, stderr } = await util.promisify(exec)(solc);
  
  if (stderr) {
    error(stderr, verbose);
  }

  await util.promisify(fs.writeFile)(outFile, stdout, 'utf8');

  info(`Contracts compiled successfully.`, verbose);
}
