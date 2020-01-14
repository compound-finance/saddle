import { InversionMap } from './inversion';
import { StructLog } from '../trace';
import { Log } from './log'
import { describeOperation } from './operator';
import { pad, trim0x } from './utils';

export interface Desc {
  op: string,
  inputs: string[],
  outputs: string[]
}

export interface TraceInfo {
  lastLog?: Log,
  inv: InversionMap
  sha: object
}

export function augmentLogs(logs: StructLog[], constants: object): { logs: Log[], info: TraceInfo } {
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

    let { extended, info: nInfo } = describeOperation(log, nextStack || [], info);
    const nLog: Log = new Log(log, extended, info.lastLog);

    return {
      logs: [...logs, nLog],
      info: {
        ...nInfo,
        lastLog: nLog
      }
    };
  }, <{logs: Log[], info: TraceInfo}>{logs: [], info: { inv, sha: {} }});
}
