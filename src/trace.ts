import { NetworkConfig } from './config';
import { TraceCollector, parseSourceMap } from '@compound-finance/sol-tracing-utils';
import { TransactionReceipt } from 'web3-core';
import { stripHexPrefix } from 'ethereumjs-util';
import chalk from 'chalk';
import Web3 from 'web3';
import { Log } from './trace/log';
import { trimZero } from './trace/utils';
import { TraceInfo, augmentLogs } from './trace/descriptor';

interface Trace {
  gas: number,
  returnValue: any,
  structLogs: StructLog[]
}

export interface StructLog {
  depth: number,
  error: string,
  gas: number,
  gasCost: number,
  memory: null | string[],
  op: string,
  pc: number,
  stack: string[],
  storage: {[key: string]: string}
}

export interface TraceOptions {
  constants?: {[key: string]: string},
  onTrace?: (Trace) => Promise<void>,
  preFilter?: undefined | ((log: StructLog) => boolean),
  postFilter?: undefined | ((log: StructLog) => boolean),
  execLog?: undefined | ((log: StructLog, info: TraceInfo) => Promise<void>)
  exec?: undefined | ((logs: StructLog[], info: TraceInfo) => Promise<void>)
}

interface ContractTraceComponents {
  address: string,
  pcToSourceRange?: any
  inverted?: any,
  gasRemaining?: number,
  callIndex?: number
}

function rpc(web3, request) {
  return new Promise((okay, fail) => web3.currentProvider.send(request, (err, res) => err ? fail(err) : okay(res)));
}

async function traceTransaction(web3, txHash, traceParams={}) {
  let {result} = <{result: Trace}>await rpc(web3, {method: 'debug_traceTransaction', params: [txHash, traceParams]});

  return result;
}

function getSource(offset, sourceFile) {
  let lines = sourceFile.slice(offset.location.start.line - 1, offset.location.end.line);
  let startCol = offset.location.start.column;
  let endCol = offset.location.end.column;
  let color = chalk.blueBright;
  let sourceLine = offset.location.start.line === offset.location.end.line ?
    `${offset.fileName}:${offset.location.start.line}[${offset.location.start.column}-${offset.location.end.column}]` :
    `${offset.fileName}:${offset.location.start.line}[${offset.location.start.column}]-${offset.location.end.line}[${offset.location.end.column}]`;

  let source = lines.reduce((result, line, i) => {
    let first = i === 0;
    let last = i === lines.length - 1;
    if (first && last) {
      // Single line
      return result + line.slice(0, startCol) + color(line.slice(startCol, endCol)) + line.slice(endCol);
    } else {
      if (first) {
        return result + line.slice(0, startCol) + color(line.slice(startCol));
      } else if (last) {
        return result + color(line.slice(0, endCol)) + line.slice(endCol);
      } else {
        return result + color(line)
      }
    }
  }, '');

  return {
    source,
    sourceLine
  };
}

export async function buildTracer(network_config: NetworkConfig) {
  let contractsData, traceCollector;
  if (network_config.artifactAdapter) {
    contractsData = await network_config.artifactAdapter.collectContractsDataAsync();
    traceCollector = new TraceCollector(network_config.artifactAdapter, true, <any>null);
  }

  let contractTraceComponentsCache = {};

  // Note: this function will memoize its input
  async function getContractTraceComponents(address, isContractCreation=false): Promise<ContractTraceComponents> {
    if (isContractCreation && address in contractTraceComponentsCache) {
      return contractTraceComponentsCache[address];
    }

    let pcToSourceRange, inverted;
    if (traceCollector) {
      let checksumAddress = network_config.web3.utils.toChecksumAddress(address);
      let bytecode = await network_config.web3.eth.getCode(checksumAddress);
      let contractData = await traceCollector.getContractDataByTraceInfoIfExistsAsync(address, bytecode, isContractCreation);

      if (!contractData) {
        throw new Error(`Failed to find contract data for given bytecode at ${address}`);
      }

      const bytecodeHex = stripHexPrefix(bytecode);
      const sourceMap = isContractCreation ? contractData.sourceMap : contractData.sourceMapRuntime;
      let pcToSourceRange = parseSourceMap(contractData.sourceCodes, sourceMap, bytecodeHex, contractData.sources);
      let inverted = Object.entries(contractData.sources).reduce((acc, [id, name]) => {
        return {
          ...acc,
          [<string>name]: contractData.sourceCodes[<string>id].split("\n")
        };
      }, {});

      let traceComponents = { address, pcToSourceRange, inverted };

      if (!isContractCreation) {
        contractTraceComponentsCache[address] = traceComponents;
      }

      return traceComponents;
    } else {
      return { address, pcToSourceRange: null, inverted: null };
    }
  }

  return async function trace(receipt: TransactionReceipt, traceOpts: TraceOptions): Promise<any> {
    let traceComponents =
      await getContractTraceComponents(receipt.contractAddress || receipt.to, receipt.contractAddress !== null);
    let { address, pcToSourceRange, inverted } = traceComponents;

    let trace = await traceTransaction(network_config.web3, receipt.transactionHash, {});

    if (traceOpts.onTrace) {
      await traceOpts.onTrace(trace);
    }

    let { logs: augmentedLogs, info: info } = augmentLogs(trace.structLogs, traceOpts.constants || {});
    let filteredLogs = traceOpts.preFilter ? augmentedLogs.filter(traceOpts.preFilter) : augmentedLogs;
    if (pcToSourceRange && inverted) {
      ({logs: filteredLogs} = await filteredLogs.reduce(async (acc, log, i, allLogs) => {
        let { logs, traceCompStack } = await acc;
        let { address, pcToSourceRange, inverted } = traceCompStack[0] || {};

        let callInput = {
          DELEGATECALL: 4,
          CALL: 5,
          CALLCODE: 5, // not sure this is right for CALLCODE
          STATICCALL: 4
        };

        const nextLog = allLogs[i + 1];
        if (!nextLog) {
          // the last opcode in a tx is a STOP or RETURN, which has no cost
          log.gasCost = 0;
        } else if (callInput[log.op]) {
          let input = log.inputs[callInput[log.op]];
          let traceComponents = await getContractTraceComponents('0x' + trimZero(input));
          traceCompStack = [
            {...traceComponents, gasRemaining: nextLog.gasCost, callIndex: i}
            , ...traceCompStack
          ];
        } else if (log.op === 'RETURN') {
          // set the gas cost of the previous call to the difference in gas between the return opcode and the call opcode
          // a RETURN code before the end of the tx means we must be in an externall call, so we'll have gasCost and gasRemaining
          logs[traceCompStack[0].callIndex!].gasCost = traceCompStack[0].gasRemaining! + nextLog.gasCost;
          // RETURN itself is 0 cost
          log.gasCost = 0;
          traceCompStack = traceCompStack.slice(1,);
        } else {
          // debug_traceTransaction's gasCosts are off by one
          log.gasCost = nextLog.gasCost;
        }

        log.setContract(address, traceCompStack.length - 1);

        let offset = pcToSourceRange ? pcToSourceRange[log.pc] : undefined;
        if (offset) {
          let sourceFile = inverted[offset.fileName];
          let {source, sourceLine} = getSource(offset, sourceFile);
          log.setSource(source, sourceLine);
        }

        return {
          logs: [...logs, log],
          traceCompStack
        };
      }, Promise.resolve({ logs: <Log[]>[], traceCompStack: [traceComponents] })));
    }

    let postFilteredLogs = traceOpts.postFilter ? filteredLogs.filter(traceOpts.postFilter) : filteredLogs;

    if (traceOpts.execLog !== undefined) {
      let {execLog} = traceOpts;

      await Promise.all(postFilteredLogs.map((log) => execLog(log, info)));
    }

    if (traceOpts.exec !== undefined) {
      await traceOpts.exec(postFilteredLogs, info);
    }

    return postFilteredLogs;
  }
}
