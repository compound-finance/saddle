import { NetworkConfig } from './config';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

let mkdir = promisify(fs.mkdir);
let rmdir = promisify(fs.rmdir);
let writeFile = promisify(fs.writeFile);

export async function writeCoverage(config: NetworkConfig, name: string, coverage: object): Promise<void> {
  await mkdir(config.coverage_dir, { recursive: true });
  let stringifiedCoverage = JSON.stringify(coverage, null, '\t');
  await writeFile(path.join(config.coverage_dir, `coverage-${name}.json`), stringifiedCoverage);
}
