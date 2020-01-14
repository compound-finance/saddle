import { StructLog } from '../trace';
import { Desc, TraceInfo } from './descriptor';
import { addInv, showInv } from './inversion';
import { last, lastN, trimZero } from './utils';

export interface ExtendedInfo {
  inputs: string[]
  outputs: string[]
  desc: string
}

function buildDesc(desc: Desc, info: TraceInfo): ExtendedInfo {
  let inputs = '';
  let outputs = '';

  if (desc.inputs.length > 0) {
    const mappedInputs = desc.inputs.map((input) => showInv(info.inv, input));

    inputs = `[${mappedInputs.join(',')}]`
  }

  if (desc.outputs.length > 0) {
    outputs = `-> 0x${desc.outputs.map(trimZero).join(',')}`;
  }

  return {
    inputs: desc.inputs,
    outputs: desc.outputs,
    desc: `${desc.op}${inputs}${outputs}`
  };
}

function buildOpDesc(log: StructLog, nextStack: string[], info: TraceInfo, opInfo: OpInfo) {
  const desc: Desc = {
    op: log.op,
    inputs:  lastN(log.stack, opInfo.inputs),
    outputs: lastN(nextStack, opInfo.outputs)
  };

  let inv = info.inv;

  if (opInfo.addInv) {
    inv = addInv(info.inv, log.op, desc.inputs, desc.outputs);
  }

  return {
    extended: buildDesc(desc, info),
    info: {
      ...info,
      inv
    }
  }
}

function pushFn(n: number) {
  return function(log: StructLog, nextStack: string[], info: TraceInfo) {
    return {
      extended: buildDesc({
        op: log.op,
        inputs: lastN(nextStack, 1),
        outputs: []
      }, info),
      info: {
        ...info,
        inv: addInv(info.inv, log.op, lastN(nextStack, 1), [])
      }
    }
  }
}

function swapFn(n: number) {
  return function(log: StructLog, nextStack: string[], info: TraceInfo) {
    return {
      extended: buildDesc({
        op: log.op,
        inputs: [last(nextStack, 1)],
        outputs: [last(nextStack, n)]
      }, info),
      info
    }
  };
}

function dupFn(n: number) {
  return function(log: StructLog, nextStack: string[], info: TraceInfo) {
    return {
      extended: buildDesc({
        op: log.op,
        inputs: lastN(nextStack, n),
        outputs: lastN(nextStack, n)
      }, info),
      info
    }
  };
}

function logFn(n: number) {
  return function(log: StructLog, nextStack: string[], info: TraceInfo) {
    return {
      extended: buildDesc({
        op: log.op,
        inputs: lastN(log.stack, n),
        outputs: []
      }, info),
      info
    }
  };
}

function sha(log: StructLog, nextStack: string[], info: TraceInfo) {
  let memory = log.memory || [];
  const memStart = parseInt(last(log.stack, 1), 16);
  const memEnd = parseInt(last(log.stack, 2), 16);

  let inputs = [memory.join('').slice(memStart * 2, memEnd * 2)];
  let outputs = lastN(nextStack, 1);
  let inv = addInv(info.inv, log.op, inputs, outputs);

  return {
    extended: buildDesc({op: log.op, inputs, outputs}, info),
    info: {
      ...info,
      inv,
      sha: {
        ...info.sha,
        [inputs[0]]: outputs[0]
      }
    }
  };
}

// SLOAD inv?
// xinv = addInv(inv, log.op, desc.inputs, desc.outputs);

interface OpInfo {
  inputs: number,
  outputs: number,
  addInv?: boolean
}

type DescFn = (log: StructLog, nextStack: string[], info: TraceInfo) => {extended: ExtendedInfo, info: TraceInfo}

const opcodes: {[name: string]: OpInfo | DescFn | null } = {
  // 0x0 range - arithmetic ops
  // name, baseCost, async
  STOP: { inputs: 0, outputs: 0 },
  ADD: { inputs: 2, outputs: 1, addInv: true },
  MUL: { inputs: 2, outputs: 1, addInv: true },
  SUB: { inputs: 2, outputs: 1, addInv: true },
  DIV: { inputs: 2, outputs: 1, addInv: true },
  SDIV: { inputs: 2, outputs: 1, addInv: true },
  MOD: { inputs: 2, outputs: 1, addInv: true },
  SMOD: { inputs: 2, outputs: 1, addInv: true },
  ADDMOD: { inputs: 3, outputs: 1, addInv: true },
  MULMOD: { inputs: 3, outputs: 1, addInv: true },
  EXP: { inputs: 2, outputs: 1, addInv: true },
  SIGNEXTEND: { inputs: 2, outputs: 1, addInv: true },

  // 0x10 range - bit ops
  LT: { inputs: 2, outputs: 1 },
  GT: { inputs: 2, outputs: 1 },
  SLT: { inputs: 2, outputs: 1 },
  SGT: { inputs: 2, outputs: 1 },
  EQ: { inputs: 2, outputs: 1 },
  ISZERO: { inputs: 1, outputs: 1 },
  AND: { inputs: 2, outputs: 1, addInv: true },
  OR: { inputs: 2, outputs: 1, addInv: true },
  XOR: { inputs: 2, outputs: 1, addInv: true },
  NOT: { inputs: 1, outputs: 1, addInv: true },
  BYTE: { inputs: 2, outputs: 1, addInv: true },
  SHL: { inputs: 2, outputs: 1, addInv: true },
  SHR: { inputs: 2, outputs: 1, addInv: true },
  SAR: { inputs: 2, outputs: 1, addInv: true },

  // 0x20 range - crypto
  SHA3: sha,

  // 0x30 range - closure state
  ADDRESS: { inputs: 0, outputs: 1 },
  BALANCE: { inputs: 1, outputs: 1 },
  ORIGIN: { inputs: 0, outputs: 1 },
  CALLER: { inputs: 0, outputs: 1 },
  CALLVALUE: { inputs: 0, outputs: 1 },
  CALLDATALOAD: { inputs: 1, outputs: 1 },
  CALLDATASIZE: { inputs: 0, outputs: 1 },
  CALLDATACOPY: { inputs: 3, outputs: 0 },
  CODESIZE: { inputs: 0, outputs: 1 },
  CODECOPY: { inputs: 3, outputs: 0 },
  GASPRICE: { inputs: 0, outputs: 1 },
  EXTCODESIZE: { inputs: 1, outputs: 1 },
  EXTCODECOPY: { inputs: 4, outputs: 0 },
  RETURNDATASIZE: { inputs: 0, outputs: 1 },
  RETURNDATACOPY: { inputs: 3, outputs: 0 },
  EXTCODEHASH: null,

  // '0x40' range - block operations
  BLOCKHASH: { inputs: 1, outputs: 1 },
  COINBASE: { inputs: 0, outputs: 1 },
  TIMESTAMP: { inputs: 0, outputs: 1 },
  NUMBER: { inputs: 0, outputs: 1 },
  DIFFICULTY: { inputs: 0, outputs: 1 },
  GASLIMIT: { inputs: 0, outputs: 1 },

  // 0x50 range - 'storage' and execution
  POP: { inputs: 1, outputs: 0 },
  MLOAD: { inputs: 1, outputs: 1 },
  MSTORE: { inputs: 2, outputs: 0 },
  MSTORE8: { inputs: 2, outputs: 0 },
  SLOAD: { inputs: 1, outputs: 1 },
  SSTORE: { inputs: 2, outputs: 0 },
  JUMP: { inputs: 1, outputs: 0 },
  JUMPI: { inputs: 2, outputs: 0 },
  PC: { inputs: 0, outputs: 1 },
  MSIZE: { inputs: 0, outputs: 1 },
  GAS: { inputs: 0, outputs: 1 },
  JUMPDEST: { inputs: 0, outputs: 0 },

  // 0x60, range
  PUSH1: pushFn(1),
  PUSH2: pushFn(2),
  PUSH3: pushFn(3),
  PUSH4: pushFn(4),
  PUSH5: pushFn(5),
  PUSH6: pushFn(6),
  PUSH7: pushFn(7),
  PUSH8: pushFn(8),
  PUSH9: pushFn(9),
  PUSH10: pushFn(10),
  PUSH11: pushFn(11),
  PUSH12: pushFn(12),
  PUSH13: pushFn(13),
  PUSH14: pushFn(14),
  PUSH15: pushFn(15),
  PUSH16: pushFn(16),
  PUSH17: pushFn(17),
  PUSH18: pushFn(18),
  PUSH19: pushFn(19),
  PUSH20: pushFn(20),
  PUSH21: pushFn(21),
  PUSH22: pushFn(22),
  PUSH23: pushFn(23),
  PUSH24: pushFn(24),
  PUSH25: pushFn(25),
  PUSH26: pushFn(26),
  PUSH27: pushFn(27),
  PUSH28: pushFn(28),
  PUSH29: pushFn(29),
  PUSH30: pushFn(30),
  PUSH31: pushFn(31),
  PUSH32: pushFn(32),

  DUP1: dupFn(1),
  DUP2: dupFn(2),
  DUP3: dupFn(3),
  DUP4: dupFn(4),
  DUP5: dupFn(5),
  DUP6: dupFn(6),
  DUP7: dupFn(7),
  DUP8: dupFn(8),
  DUP9: dupFn(9),
  DUP10: dupFn(10),
  DUP11: dupFn(11),
  DUP12: dupFn(12),
  DUP13: dupFn(13),
  DUP14: dupFn(14),
  DUP15: dupFn(15),
  DUP16: dupFn(16),

  SWAP1: swapFn(1),
  SWAP2: swapFn(2),
  SWAP3: swapFn(3),
  SWAP4: swapFn(4),
  SWAP5: swapFn(5),
  SWAP6: swapFn(6),
  SWAP7: swapFn(7),
  SWAP8: swapFn(8),
  SWAP9: swapFn(9),
  SWAP10: swapFn(10),
  SWAP11: swapFn(11),
  SWAP12: swapFn(12),
  SWAP13: swapFn(13),
  SWAP14: swapFn(14),
  SWAP15: swapFn(15),
  SWAP16: swapFn(16),

  LOG0: logFn(0),
  LOG1: logFn(1),
  LOG2: logFn(2),
  LOG3: logFn(3),
  LOG4: logFn(4),

  // '0xf0' range - closures
  CREATE: { inputs: 3, outputs: 1 },
  CALL: { inputs: 7, outputs: 1 },
  CALLCODE: { inputs: 7, outputs: 1 },
  RETURN: { inputs: 2, outputs: 0 },
  DELEGATECALL: { inputs: 6, outputs: 1 },
  CREATE2: null,
  STATICCALL: { inputs: 6, outputs: 1 },
  REVERT: { inputs: 2, outputs: 0 },

  // '0x70', range - other
  INVALID: null,
  SELFDESTRUCT: { inputs: 1, outputs: 0 },

  // istanbul (double check)
  CHAINID: { inputs: 0, outputs: 1 },
  SELFBALANCE: { inputs: 0, outputs: 1 },
}

export function describeOperation(log: StructLog, nextStack: string[], info: TraceInfo): { extended: ExtendedInfo, info: TraceInfo } {
  let opinfo = opcodes[log.op];

  if (!opinfo) {
    return {
      extended: {
        desc: log.op,
        inputs: [],
        outputs: []
      },
      info
    };
  } else if (typeof(opinfo) === 'function') {
    return opinfo(log, nextStack, info);
  } else {
    return buildOpDesc(log, nextStack, info, opinfo);
  }
}
