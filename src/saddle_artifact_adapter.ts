// import { FallthroughResolver, FSResolver, NPMResolver, RelativeFSResolver, URLResolver } from '@0x/sol-resolver';
// import { logUtils } from '@0x/utils';
// import { CompilerOptions, ContractArtifact } from 'ethereum-types';
import * as fs from 'fs';
// import * as glob from 'glob';
// import * as _ from 'lodash';
// import * as path from 'path';
import {promisify} from 'util';

// import { ContractData, SourceCodes, Sources } from '../types';

import { AbstractArtifactAdapter } from '@compound-finance/sol-coverage';

// const CONFIG_FILE = 'compiler.json';

export class SaddleArtifactAdapter extends AbstractArtifactAdapter {
  private readonly _buildDir: string;
  private readonly _contractsFile: string;
  private readonly _coverageIgnore: string[];
  // private readonly _sourcesPath: string;
  // private readonly _resolver: FallthroughResolver;
  /**
   * Instantiates a SolCompilerArtifactAdapter
   * @param artifactsPath Path to your artifacts directory
   * @param sourcesPath Path to your contract sources directory
   */
  constructor(buildDir: string, contractsFile: string, coverageIgnore: string[]) {
    super();
    this._buildDir = buildDir;
    this._contractsFile = contractsFile;
    this._coverageIgnore = coverageIgnore;
  }

  public async collectContractsDataAsync() {
    const contractsFile = `${this._buildDir}/${this._contractsFile}`;
    const json = JSON.parse(await promisify(fs.readFile)(contractsFile, 'utf8'))
    const contracts: {string: object} = json['contracts'];
    const sourceList: string[] = json['sourceList'];
    const sourceIndex = sourceList.reduce((acc, el, i) => ({...acc, [el]: i}), {});

    return Object.entries(contracts).reduce((res, [contractName, contract]) => {
      let metadata = JSON.parse(contract['metadata']);
      let [sources, sourceCodes] =
        Object.entries(metadata['sources']).reduce(([sources, sourceCodes], [path, source]) => {
          let i = sourceIndex[path];

          return [
            {
              ...sources,
              [i]: path
            },
            {
              ...sourceCodes,
              [i]: (<any>source)['content']
            }
          ]
        }, [{}, {}]);

      const contractData = {
        name: contractName.split(':')[0],
        sourceCodes,
        sources,
        bytecode: '0x' + contract['bin'],
        sourceMap: contract['srcmap'],
        runtimeBytecode: '0x' + contract['bin-runtime'],
        sourceMapRuntime: contract['srcmap-runtime'],
      };

      const isInterfaceContract = contractData.bytecode === '0x' && contractData.runtimeBytecode === '0x';
      const isIgnored = this._coverageIgnore.includes(contractData.name);

      if (isInterfaceContract || isIgnored) {
        return res;
      } else {
        return [
          ...res,
          contractData
        ];
      }
    }, <any[]>[]);
  }
}
