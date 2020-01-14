import { chunk, trimZero } from './utils';

export interface InversionItem {
  operation: string
  inputs: string[]
}

export interface InversionMap {
  [key: string]: InversionItem[]
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
