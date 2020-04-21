import fs from 'fs';
import path from 'path';
import util from 'util';

import {info, debug, warn, error} from '../../logger';

export async function init(verbose: number): Promise<void> {
  info(`Saddle: building default configuration...\n`, verbose);

  const inPath = path.join(__dirname, '..', '..', '..', 'saddle.config.js');
  const outPath = path.join(process.cwd(), 'saddle.config.js');

  const saddleConfigJS = await util.promisify(fs.readFile)(inPath, 'utf8');

  const template = saddleConfigJS.replace(/^  (.*)$/mg, '  // $1');
  await util.promisify(fs.writeFile)(outPath, template);

  warn(`Saddle: see default configuration stored at ${outPath}.\n`, verbose);
}
