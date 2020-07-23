import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { loadConfig } from '../../config';
import { mkdirp, writeFile } from '../../file';
import { getBuildFile } from '../../contract';

import { info, debug, warn, error } from '../../logger';

export async function compile(trace: boolean, verbose: number, pretty: boolean): Promise<void> {
  let config = await loadConfig(undefined, trace);

  let outFile = getBuildFile(config);
  let outDir = path.basename(config.build_dir);

  let solc;
  if (trace || config.trace) {
    solc = `${config.solc} --combined-json bin,bin-runtime,abi,metadata,asm,srcmap,srcmap-runtime --metadata-literal --optimize ${config.solc_args.join(" ")} ${config.contracts}`;
  } else {
    solc = `${config.solc} --combined-json bin,abi,metadata --metadata-literal --optimize ${config.solc_args.join(" ")} ${config.contracts}`;
  }

  info(`Compiling contracts ${config.contracts} with ${config.solc} to ${outFile}...`, verbose);
  debug(`Running \`${solc}\``, verbose)

  await mkdirp(outDir);
  const { stdout, stderr } = await promisify(exec)(solc, config.solc_shell_args);

  if (stderr) {
    error(stderr, verbose);
  }

  let formattedOut =
    pretty ? JSON.stringify(JSON.parse(stdout), null, 2) : stdout;

  await writeFile(outFile, formattedOut);

  info(`Contracts compiled successfully.`, verbose);
}
