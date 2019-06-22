import fs from 'fs';
import util from 'util';
import {exec} from 'child_process';

import {info, debug, warn, error} from '../logger';

export async function compile(network: string, verbose: number): Promise<void> {
  info(`compiling server on ${network}`, verbose);

  const buildDir = './.build';
  const outFile = `${buildDir}/contracts.json`;
  const solc = "solc --combined-json bin,abi --optimize contracts/*.sol";

  await util.promisify(fs.mkdir)(buildDir, { recursive: true });
  const { stdout, stderr } = await util.promisify(exec)(solc);
  
  if (stderr) {
    error(stderr, verbose);
  }

  await util.promisify(fs.writeFile)(outFile, stdout, 'utf8');
}
