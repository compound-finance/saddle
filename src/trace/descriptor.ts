import { InversionMap, StructLog, TraceInfo } from '../trace';
import { describeOperation } from './operator';
import { chunk, pad, trimZero, trim0x } from './utils';
import Web3 from 'web3';
import chalk from 'chalk';

let web3 = new Web3();

export interface Desc {
  op: string,
  inputs: string[],
  outputs: string[]
}

let seen = {};

export function showInv(inv: InversionMap, key: string): string {
  if (key.length > 64) {
    let res = chunk(key, 64).map((chk) => {
      return doShowInv(inv, <string>chk);
    });

    return `CONCAT(${res.join(',')})`;
  } else {
    return doShowInv(inv, key);
  }
}

function doShowInv(inv: InversionMap, key: string): string {
  let res;

  if (seen[key]) {
    return seen[key]
  } else if (parseInt(key, 16) < 10000) { // ignore small numbers
    res = `0x${trimZero(key)}`;
  } else if (inv[key] && inv[key][0]) {
    // For now, we'll just use the first if we have multiple
    // This is probably good since it's when the value first arrived
    const el = inv[key][0];
    if (el.inputs.length > 0) {
      const inputs = el.inputs.map((input) => showInv(inv, input))
      res = `${el.operation}(${inputs.join(',')})`;
    } else {
      return el.operation;
    }
  } else {
    res = `0x${trimZero(key)}`;
  }

  seen[key] = res;
  return res;
}

export function addInv(inv: InversionMap, op: string, inputs: string[], outputs: string[]): InversionMap {
  return outputs.reduce((inv, output) => {
    let curr = inv[output] || [];

    return {
      ...inv,
      [output]: [
        ...curr,
        {
          operation: op,
          inputs: inputs
        }
      ]
    };
  }, inv);
}

export function augmentLogs(logs, constants) {
  const inv = Object.entries(constants).reduce((inv, [k, v] ) => {
    const key = pad(trim0x(v)).toLowerCase();

    return {
      ...inv,
      [key]: [
        {
          operation: k,
          inputs: []
        }
      ]
    };
  }, {});

  return logs.reduce(({logs, info}, log, i, allLogs) => {
    const nextLog: StructLog | undefined = allLogs[i + 1];
    const nextStack = nextLog ? nextLog.stack : undefined;

    let {log: nLog, info: nInfo} = describeOperation(log, nextStack || [], info);

    nLog.lastDesc = info.lastLog ? info.lastLog.desc : undefined;
    nLog.show = function() {
      if (log.source) {
        console.log(`${log.source.trim()}\n↓\n${chalk.blueBright(log.desc)}`);
      } else {
        console.log(chalk.blueBright(log.desc));
      }
    }

    return {
      logs: [...logs, nLog],
      info: {
        ...nInfo,
        lastLog: nLog
      }
    };
  }, <{logs: StructLog[], info: TraceInfo}>{logs: [], info: {lastLog: undefined, inv}});
}
