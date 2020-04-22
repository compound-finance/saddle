
## Saddle

Saddle is a simple framework for developing Ethereum Smart Contracts. Think of it like a lean and mean version of truffle.

## Philosophy

**What saddle does**

  * Allows you to compile and deploy your contracts.
  * Add fast, parallelized tests for your contracts.
  * Trace and debug your contracts
  * Verify your contracts on Etherscan

**What saddle does not**

  * Migrations. It's just "deploy".
  * Solidity-language tests
  * npm-based Solidity plugins
  * solcjs [that is, for performance, saddle requires native solc]

## Installing Saddle

To install saddle, simply create a new npm or yarn project and run:

```
yarn add eth-saddle
# or
npm install eth-saddle --save
```

## Using Saddle

After you've installed saddle, you can compile, test or deploy your contracts. See `saddle help` for more information. See `configuration` below for configuration help.

Let's assume you define a simple Ethereum contract:

`contracts/MyContract.sol`

```solidity
pragma solidity ^0.5.16;

contract MyContract {
	function myFunc() pure external returns (uint256) {
		return 55;
	}
}
```

Now, you can compile your contract with:

```bash
npx saddle compile
```

`saddle compile` will compile your contracts and store the built output in `./build/contracts.json`. This is the raw output of solc compile.

After you've compiled, you can deploy your contracts:

```bash
npx saddle deploy -n development
```

This will deploy your comiled contracts to development (for this, you should have [ganache-cli](https://github.com/trufflesuite/ganache-cli) running). For more information on configuring your deployment for rinkeby or mainnet, see the configuration section below.

After you have deployed, you will also see the contract address listed in `./build/development.json`, if you want to keep track of your deployments.

## Testing Smart Contracts

Note: before testing, you currently have to compile your contracts. To run your tests, then, run:

```bash
npx saddle compile && npx saddle test
```

`saddle test` runs your tests. To add tests, create a directory `/tests` and add some simple tests, e.g.

`tests/MyTest.js`

```javascript
describe('View', () => {
  test('deploy and read contract', async () => {
    let ctx = await deploy('MyContract', []);

    expect(await call(ctx.methods.myFunc())).toEqual(55);
  });
}
```

Saddle provides a few helper functions for your tests, which are:

* `web3` - A web3 instance connected to the chosen provider
* `account` - The default account for web3
* `accounts` - A list of unlocked accounts for web3
* `deploy(contract: string, args: any[], sendOptions: SendOptions={})` - Deploys a contract
* `call(contract: Contract, method: string, arguments: any[], callOptions: CallOptions={})` - Call a function on a contract
* `send(contract: Contract, method: string, arguments: any[], sendOptions: SendOptions={})` - Send a transaction on a contract

You can really get by without using most of these functions (except maybe deploy), since they are light wrappers around web3 functions, but the wrappers will allow saddle to provide better helpers and diagnostics in the future.

## Tracing

Saddle comes with a tracing library that can analyze transaction receipts. This is useful in debugging and testing. For example:

```javascript
test('balance has one read', async () => {
  // Run the transaction (here, balanceOf) so we can trace it
  let trxReceipt = await comp.methods.balanceOf(saddle.accounts[0]).send();

  await saddle.trace(trxReceipt, {
    constants: {
      "account": saddle.accounts[0] // tracing code will note this as an address
    },
    preFilter: ({op}) => op === 'SLOAD', // filter all operations to find only SLOADs
    // we can filter by source code if we want
    // note: source code only available when running in `trace mode`
    postFilter: ({source}) => !source || source.includes('balanceOf'),
    execLog: (log) => {
      log.show(); // show each load operation
    },
    exec: (logs, info) => {
      expect(logs.length).toEqual(1); // make sure there's only one matching operation
    }
  });
});
```

The code above will trace and make sure only one Ethereum read operation was called in that operation. The logs (when run in trace mode) will look like this:

```bash
Log       pc=503 op=SLOAD source=contracts/Token.sol:100[24-45]
Solidity  uint balance = _balances[account];
          ↓
EVM Asm   SLOAD[SHA3(CONCAT(account,0x4))]-> 0x1
```

That is, when the program counter (PC) reached 503, we did an SLOAD from line 100 of Token.sol (shown below). The SLOAD was based on the SHA3 of the `account` address added to `0x4` (Solidity's fourth slot) and yielded a balance of 1 wei.

Trace Features:

* `constants` - Saddle's data analysis tool will note that these values should be tokenized. Note: saddle expects values like this to be globally unique (like addresses or hash results).
* `preFilter` - Given a simple trace log object, return true to continue processing on that log. Each log will go through detailed tracing and it's good to remove irrelevant logs here.
* `postFilter` - After each log has been analyzed and mapped to source code, you can add additional filters here.
* `execLog` - Once per log, run the following (possibly async) function.
* `exec` - Once per trace, run the following function with all logs passed in.

If you have new features or analysis you'd like to add to tracing, feel free to open an issue or craft a PR. The goal is to make useful analysis tools to help bridge the mental model of Solidity to the Ethereum virtual machine.

## CLI

Deploying a contract:

```bash
npx saddle deploy MyContract Arg0 Arg1 -n rinkeby
```

Verifying a contract on [Etherscan](https://etherscan.io):

```bash
npx saddle verify "{Etherscan API Key}" MyContract Arg0 Arg1 -n rinkeby
```

Matching an on-chain contract matches your local contract's compilation:

```bash
npx saddle match 0x... MyContract Arg0 -n rinkeby
```

You can also start a saddle console:

```bash
npx -n --experimental-repl-await saddle console
```

```javascript
Saddle console on network development Web3ProviderEngine
> saddle
Saddle {
  ...
}
> .deploy Counter
Deploying contract Counter with args []
Deployed Counter at 0x81d2b78e483Ad6e9bc8e1a46F45434cFbad980B5
> await counter.methods.count().call()
0
```

Available commands:
  * `.compile` - Recompile and reload contracts
  * `.contracts` - Show all contracts with constructor args
  * `.deployed` - Show all contracts deployed on this network
  * `.deploy <contract> <...args>` - Deploy a given contract
  * `.network` - Show given network
  * `.provider` - Show given provider

You can recompile contracts in the repl by running `.compile`.

## Scripts

You can also run scripts from saddle. For instance, you can run:

```bash
npx saddle script myScript.js arg0 arg1
```

And then if you have a script such as:

```javascript
// my_script.js

const [name, symbol] = args;

async function() {
  let contract = await saddle.deploy('MyContract', [name, symbol]);
  console.log(`Deployed MyContract to ${contract.address}`);
}();
```

This should open up the ability to create complex deployment scripts.

## Configuration

Saddle comes with reasonable default configuration, but you can override it. The core of the configuration is a list of "sources" for any given configuration-item, allowing the framework to look at say an environment variable for a provider, or if that is missing, a file with the provider information, or if that is missing, use a default http endpoint. This would be described as:

```javascript
...
provider: [{env: "PROVIDER"}, {file: "~/.ethereum-provider"}, {http: "http://rinkeby.infura.io"}]
```

To set your own configuration, simply run: `saddle init` and this will create a file `saddle.config.js`. Make any changes to the configuration you need in that file

## How to build and use saddle package locally 
1. Building and linking saddle package for local usage: 
```bash
yarn install
yarn prepare 
yarn link
```

2. Linking locally built saddle package inside the project where you want to use it: 
```bash
yarn link "eth-saddle"
```

3. To reverse linking process, simply use:
```bash 
yarn unlink "eth-saddle"
```

## Contributing

Please create an issue for any questions. In the interest of keeping saddle as simple as possible, we will not try to mimic all features of more complex frameworks-- so it's better to discuss first before submitting PRs.

Thanks and enjoy!
