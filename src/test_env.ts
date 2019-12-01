import NodeEnvironment from 'jest-environment-node';
import expect from 'expect';
import {getSaddle} from './saddle';

export default class CustomEnvironment extends NodeEnvironment {
  private web3;
  private coverage;

  constructor(config) {
    super(config);
    this.coverage = config.testEnvironmentOptions['coverage'] === 'true';
  }

  async setup() {
    let start = new Date();
    let saddle = await getSaddle('test', this.coverage);
    this.global['saddle'] = saddle;
    this.global['web3'] = saddle.web3;
    this.global['call'] = saddle.call;
    this.global['send'] = saddle.send;
    this.global['deploy'] = saddle.deploy;
    this.global['account'] = saddle.account;
    this.global['accounts'] = saddle.accounts;
    console.log(`Setup in ${new Date().getTime() - start.getTime()} ms`)

    await super.setup();
  }

  async teardown() {
    if (this.coverage) {
      await this.global['saddle'].config.providerEngine.stop();
      await this.global['saddle'].config.cov.writeCoverageAsync();
    }

    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}
