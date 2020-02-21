import { StructLog } from '../trace';
import { ExtendedInfo } from './operator';
import chalk from 'chalk';

export class Log {
  depth: number
  error: string
  gas: number
  gasCost: number
  memory: null | string[]
  op: string
  pc: number
  stack: string[]
  storage: {[key: string]: string}
  contract?: string
  delegateCallDepth?: number
  source?: string
  sourceLine?: string
  desc: string
  inputs: string[]
  outputs: string[]
  lastLog?: Log

  constructor(log: StructLog, extended: ExtendedInfo, lastLog: Log | undefined) {
    this.depth = log.depth;
    this.error = log.error;
    this.gas = log.gas;
    this.gasCost = log.gasCost;
    this.memory = log.memory;
    this.op = log.op;
    this.pc = log.pc;
    this.stack = log.stack;
    this.storage = log.storage;
    this.desc = extended.desc;
    this.inputs = extended.inputs;
    this.outputs = extended.outputs;
    this.lastLog = lastLog;
  }

  public setSource(source: string, sourceLine: string) {
    this.source = source;
    this.sourceLine = sourceLine;
  }

  public setContract(contract: string, delegateCallDepth: number) {
    this.contract = contract;
    this.delegateCallDepth = delegateCallDepth;
  }

  public show() {
    if (this.source) {
      console.log([
        `${chalk.gray("Log")}       pc=${this.pc} op=${this.op} source=${this.sourceLine}`,
        `Solidity  ${this.source.trim()}`,
        `          ↓`,
        `EVM Asm   ${chalk.blueBright(this.desc)}`,
        ``
      ].join("\n"));
    } else {
      console.log(chalk.blueBright(this.desc));
    }
  }
}
