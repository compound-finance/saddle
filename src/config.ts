import Web3 from 'web3';
import {Web3ModuleOptions, Provider} from 'web3-core';
import path from 'path';
import ganache from 'ganache-core';
import {arr, mergeDeep, tryNumber, readFile} from './utils';
import {debug} from './cli/logger';

type NumericSource = { env: string } | { default: string }
type ProviderSource = { env: string } | { file: string } | { http: string } | { ganache: object }
type AccountSource = { env: string } | { file: string } | { unlocked: number }

export interface SaddleWeb3Config {
  gas: NumericSource | NumericSource[]
  gas_price: NumericSource | NumericSource[]
  options: Web3ModuleOptions
}

export interface SaddleNetworkConfig {
  providers: ProviderSource | ProviderSource[]
  web3: SaddleWeb3Config
  accounts: AccountSource | AccountSource[]
}

export interface SaddleConfig {
  solc: string
  solc_args: string[]
  build_dir: string
  contracts: string
  tests: string[]
  networks: {[network: string]: SaddleNetworkConfig}
}

export interface Web3Config {
  gas: number
  gas_price: number
  options: object
}

export interface NetworkConfig {
  solc: string
  solc_args: string[]
  build_dir: string
  contracts: string
  tests: string[]
  network: string
  web3: Web3
  account: string
  defaultOptions: Web3ModuleOptions
}

export async function loadConfig(file?: string): Promise<SaddleConfig> {
  let customJson = {};

  try {
    customJson = require(file || path.join(process.cwd(), 'saddle.config.js'));
  } catch (e) {
    if (!!file) {
      throw new Error(`Cannot read saddle JSON: ${file}`);
    }
  }

  const defaultJson = require(path.join(__dirname, '..', 'saddle.config.js'));

  return mergeDeep(defaultJson, customJson);
}

async function fetchProvider(source: ProviderSource): Promise<Provider | undefined> {
  function maybeProvider(source: string | undefined) {
    return source && source.length > 0 ? new Web3.providers.HttpProvider(source) : undefined;
  }

  if (!source) {
    return undefined;
  } else if ('ganache' in source) {
    return ganache.provider(source['ganache']);
  } else if ('env' in source) {
      return maybeProvider(process.env[source.env]);
  } else if ('file' in source) {
    try {
      return maybeProvider(await readFile(source.file, 'utf8'));
    } catch (e) {
      return undefined;
    }
  } else if ('http' in source) {
    return maybeProvider(source.http);
  }
}

async function fetchAccount(source: AccountSource, web3: Web3): Promise<string | undefined> {
  if (!source) {
    return undefined;
  } else if ('unlocked' in source) {
    // We'll actually ping the provider 😬
    let accounts = await web3.eth.getAccounts();
    let index = Number(source.unlocked);

    return accounts[index];
  } else if ('env' in source) {
    let privateKey = process.env[source.env];
    if ( privateKey )   {
      let account = web3.eth.accounts.wallet.add(privateKey);
      return account.address;
    } else {
      return undefined;
    }
  } else if ('file' in source) {
    try {
      let privateKey = await readFile(source.file, 'utf8');
      let account = web3.eth.accounts.wallet.add('0x' + privateKey.trim());
      return account.address;
    } catch (e) {
      return undefined;
    }
  }
}

async function fetchNumeric(source: NumericSource): Promise<number | undefined> {
  if (!source) {
    return undefined;
  } else if ('default' in source) {
    return tryNumber(source.default);
  } else if ('env' in source) {
    return tryNumber(process.env[source.env]);
  }
}

async function fetchWeb3(providers: ProviderSource[], accounts: AccountSource[], web3Config: SaddleWeb3Config): Promise<{account: string, web3: Web3, defaultOptions: Web3ModuleOptions}> {
  let provider = await findValidConfig(providers, fetchProvider)
  let gas = await findValidConfig(web3Config.gas, fetchNumeric)
  let gasPrice = await findValidConfig(web3Config.gas_price, fetchNumeric);

  let web3 = new Web3(provider);

  let account = await findValidConfig(accounts, async (el) => {
    return fetchAccount(el, web3);
  });

  let defaultOptions: Web3ModuleOptions = {
    ...web3Config.options,
    gas,
    gasPrice,
    from: account
  };

  return {account, web3, defaultOptions};
}

async function findValidConfig(options, fetcher) {
  let validOption = await arr(options).reduce<Promise<any>>(async (acc, el) => await acc ? await acc : await fetcher(el), Promise.resolve(undefined));
  if (!validOption) {
    throw new Error(`missing valid config from ${JSON.stringify(options)}`);
  }
  return validOption;
}

export async function instantiateConfig(config: SaddleConfig, network: string): Promise<NetworkConfig> {
  let networkConfig = config.networks[network];

  if (!networkConfig) {
    throw new Error(`missing network ${network} in config`);
  }

  const {account, web3, defaultOptions} = await fetchWeb3(arr(networkConfig.providers), arr(networkConfig.accounts), networkConfig.web3);

  return {
    solc: config.solc,
    solc_args: config.solc_args,
    build_dir: config.build_dir,
    contracts: config.contracts,
    tests: config.tests,
    network: network,
    web3,
    account,
    defaultOptions
  };
}
