import NodeEnvironment from 'jest-environment-node';
import expect from 'expect';
import {getSaddle} from './saddle';
import {writeCoverage} from './coverage';
import * as path from 'path';

export default class CustomEnvironment extends NodeEnvironment {
  private web3;
  private coverage;
  private testName;

  constructor(config, context) {
    super(config);
    this.testName = path.relative(process.cwd(), context.testPath).split(path.sep).join('-').replace('.', '_');
    this.coverage = config.testEnvironmentOptions['coverage'] === 'true';
  }

  async setup() {
    let start = new Date();
    let saddle = await getSaddle('test', this.coverage);
    this.global['saddle'] = saddle;
    this.global['coverage'] = this.coverage;
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
    let start = new Date();
    if (this.coverage) {
      await this.global['saddle'].network_config.providerEngine.stop();
      let coverage = this.global['saddle'].network_config.cov._coverageCollector._collector.getFinalCoverage();
      await writeCoverage(this.global['saddle'].saddle_config, this.testName, coverage);
    }
    delete this.global['saddle'];
    delete this.global['coverage'];
    delete this.global['web3'];
    delete this.global['call'];
    delete this.global['send'];
    delete this.global['deploy'];
    delete this.global['account'];
    delete this.global['accounts'];
    console.log(`Teardown in ${new Date().getTime() - start.getTime()} ms`)

    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}
