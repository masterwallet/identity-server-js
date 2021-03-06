require('chai').should();

const network = 'ETH';
const modEthereum = require('./eth')({ network });
const networkConfig = {
  value: network, name: 'Ethereum', 
  testnet: true, 
  rpcRoot: 'http://127.0.0.1:8545', rpc: 'http://127.0.0.1:8545',
  api: 'http://127.0.0.1:9911'
};

const { getWeb3Client, isNetworkRunning } = require('./web3-helper')({ network });
const { isEtherscanRunning, getEtherscanClient } = require('./etherscan-helper')({ network });
const { httpEndpointFromConfig } = require('./ethereum-networkhelper')({ network });
const ethereumQuery = require('./ethereum-query');
const encodeHelper = require('./ethereum-encodehelper');

const Genesis = require('./ethereum-genesis')({ network });

const sleep = ms => (new Promise(resolve => { setTimeout(resolve, ms); }));

describe("Ethereum network", () => {

  let isTestAvailable = null;
  let isEtherscanAvailable = null;

  beforeEach(async function() {
    const title = this.currentTest.title;
    let skipped = false;

    // tests that doesn't need network to be running
    const notInNetwork = [
      'Add to HD wallet', 'Create Random Wallet',
      'Address Validation (Checksum)', 'Address Validation',
      'Encrypt private key', 'Decrypt private key'
    ];
    // tests that need etherscan api to be available too
    const withEtherscan = ['Get Assets Balance', 'Send Assets'];

    if (notInNetwork.indexOf(title) === -1) {
      if (isTestAvailable === null) isTestAvailable = await isNetworkRunning({ config: networkConfig });
      if (!isTestAvailable) { this.skip(); skipped = true; }
    }
    if (!skipped && withEtherscan.indexOf(title) !== -1) {
      if (isEtherscanAvailable === null) isEtherscanAvailable = await isEtherscanRunning({ config: networkConfig });
      if (!isEtherscanAvailable) { this.skip(); skipped = true; }
    }
  });

  it('Add to HD wallet', async () => {
    const bip39 = require('bip39');
    const mnemonic = 'stock script strategy banner space siege picture miss million bench render fun demise wheel pulse page paddle tower fine puppy sword acoustic grit october';
    // root key: xprv9s21ZrQH143K2eorBS1xakyr8q8cutw1tQfrkdDRAR7KA4zXEZp9SdoJtYozQ4aXpQFovWiPM4driRSN8ppVW3yWX3D7qYV3JCEV95XbE1X
    // extended private key: xprv9ywEWCE3XXtntZuVxHXSnC8pArKFrVZwcH9BavX1HG2FndZFoevggwaCHUfVg6GrkE6vQKg774Y1zN7AxEZ1Xu6kEziKkvgPcLjRv8Roh8P
    // extended public key: xpub6CvauhkwMuT673yy4K4T9L5Yit9kFxHnyW4nPJvcqbZEfRtQMCEwEjtg8kmiTGNuXcAiZ2WV5uFX8s6SN7V1hhmmo5THajfX3tBu2o5zGcx
    const seed = bip39.mnemonicToSeed(mnemonic);
    const index = 0;
    const res = await modEthereum.create({ seed, index, networkConfig });
    res.should.have.property('path');
    res.should.have.property('address');
    res.should.have.property('privateKey');
    // res.path.should.equal("m/44'/60'/0'/0/0");
    res.address.should.equal('0xe17ED9eD45fFAeAbf01970f7C05Ca1bcD15Fd241');
    res.privateKey.should.equal('0xbe91a8e265788f2314502f16976eefd64831539503fb11432d91196e1b01267b');
  });

  it('Get ETH Balance', async () => {
    const web3 = getWeb3Client(networkConfig);
    const { address } = Genesis.createRandomAccount({ web3 });
    // console.log('crediting address', address);
    const tx = await Genesis.creditAccount({ web3, address, value: 10000000000000000 });
    // console.log("result tx=", tx);
    const walletPublicConfig = { networkConfig, address };
    const res = await modEthereum.getBalance({ walletPublicConfig });
    res.length.should.equal(1);
    res[0].symbol.should.equal('ETH');
    res[0].name.should.equal('Ethereum');
    res[0].value.should.equal('0.01');
  });

  it('Address Validation', async () => {
    const address = '0xe17ED9eD45fFAeAbf01970f7C05Ca1bcD15Fd241';
    const res = modEthereum.isValidAddress({ address });
    res.should.be.a('object');
    res.valid.should.equal(true);
    res.checksum.should.equal(true);
  });

  it('Invalid Address Validation', async () => {
    const address = 'e17ED9eD45fFAeAbf01970f7C05Ca1bcD15Fd241';
    const res = modEthereum.isValidAddress({ address });
    res.should.be.a('object');
    res.valid.should.equal(false);
    res.error.should.be.a('string');
  });

  it('Valid Primary Key Validation', async () => {
    const validPk = '57313bbe4a12900498ad234381289134698573d7003ec33843dd580bb9158b3c';
    const invalidPk = '0x57313bbe4a12900498ad234381289134698573d7003ec33843dd580bb9158b3c';
    const res = modEthereum.isValidPrivateKey({ privateKey: validPk });
    res.should.be.a('object');
    res.valid.should.equal(true);
  });

  it('Invalid Primary Key Validation', async () => {
    const invalidPk = '0x57313bbe4a12900498ad234381289134698573d7003ec33843dd580bb9158b3c';
    const res = modEthereum.isValidPrivateKey({ privateKey: invalidPk });
    res.should.be.a('object');
    res.valid.should.equal(false);
    res.error.should.be.a('string');
  });

  it('Encrypt private key', () => {
    // const privateKey = '0xbe91a8e265788f2314502f16976eefd64831539503fb11432d91196e1b01267b';
    // const password = '123456789';
    // const res = modEthereum.encryptPrivateKey({ key: privateKey, password, networkConfig });
  });

  const createMyTokenContract = async ({ web3 }) => {
    const fs = require('fs');
    const jsonPath = __dirname + "/MyToken.json";
    const json = JSON.parse(fs.readFileSync(jsonPath));
    const { contractName, abi, bytecode } = json;
    const contractAddress = await Genesis.createTokenContract({ web3, contractName, abi, bytecode });
    return { contractAddress, abi };
  }

  // skipping this - as it is usually very slow
  it('Get Assets Balance', async () => {
    const web3 = getWeb3Client(networkConfig);
    const { contractAddress, abi } = await createMyTokenContract({ web3 });
    const { address } = Genesis.createRandomAccount({ web3 });
    const receipt = await Genesis.creditTokens({ web3, contractAddress, abi, to: address, tokens: 3000000 });
    //console.log({ receipt });
    receipt.should.be.a('object');
    receipt.transactionHash.should.be.a('string');
    receipt.logs.should.be.a('array');
    receipt.status.should.equal('0x1');

    const etherscan = getEtherscanClient(networkConfig);
    
    const waitForBlock = setInterval(async () => {
      const blockInfo = await etherscan.getLatestBlock();
      if (parseInt(blockInfo, 16) >= receipt.blockNumber) {
        clearInterval(waitForBlock);
        const walletPublicConfig = { networkConfig, address };
        const res = await modEthereum.getAssetsList({ walletPublicConfig });
  
        const myToken = res.filter(asset => (asset.symbol === 'MY'));
        myToken.length.should.equal(1);
      }
    }, 1000);
  });

  it('Send ETH', async () => {

    const web3 = getWeb3Client(networkConfig);

    // create random (src)  account#1 (address + privateKey), credit it.
    const { address, privateKey } = await modEthereum.createRandom({ networkConfig });
    const walletPrivateConfig = { networkConfig, address, privateKey };
    const endpoint = httpEndpointFromConfig(networkConfig);

    // create random (dest) account#2 (address)
    const dest = await modEthereum.createRandom({ networkConfig });
    const to = dest.address;
    const gasPrice = 41; // 41 GWei

    const amount = 0.1; 
    const gasLimit = parseInt( await ethereumQuery.query({
      method: 'eth_estimateGas', params : [{
        from: address,
        to,
        value: modEthereum.toWeiHex(amount)
      }], endpoint
    }), 16);
    const gasFee = gasPrice * gasLimit;

    //console.log('gasLimit=', gasLimit, 'gasFee=', gasFee);
    
    Genesis.creditAccount({ web3, address, value: modEthereum.toWei(amount) + gasFee * Math.pow(10, 9)});

    const balanceOfSender = await modEthereum.getBalance({ walletPublicConfig: walletPrivateConfig });
    //console.log('credited address=', address, ', balanceOfSender=', balanceOfSender[0].value, 'in wei:', modEthereum.toWei(balanceOfSender[0].value));

    balanceOfSender[0].should.be.a('object');
    balanceOfSender[0].symbol.should.equal('ETH');
    balanceOfSender[0].value.should.equal((amount + gasFee / Math.pow(10, 9)).toString());

    // use modEthereum.sendTransaction to send the funds
    const res = await modEthereum.sendTransaction({ asset: 'ETH', to: dest.address, amount, gasPrice, gasLimit, walletPrivateConfig });
    //console.log(res);
    const balanceOfDestination = await modEthereum.getBalance({ walletPublicConfig: { networkConfig, address: dest.address } });
    //console.log(res, balanceOfDestination);
    parseFloat(balanceOfDestination[0].value).should.equal(amount);
  });

  it('Send Assets', async () => {
    const web3 = getWeb3Client(networkConfig);
    const account1 = await modEthereum.createRandom({ networkConfig });
    const account2 = await modEthereum.createRandom({ networkConfig });
    const { contractAddress, abi } = await createMyTokenContract({ web3 });
    const walletPrivateConfig = { 
      address: account1.address, 
      privateKey: account1.privateKey, 
      networkConfig 
    };
    await Genesis.creditAccount({ web3, address: account1.address, value: modEthereum.toWei(10) });
    await Genesis.creditTokens({ web3, contractAddress, abi, to: account1.address, tokens: 3 * Math.pow(10, 18) });
    // const acc1Balance = await modEthereum.getBalance({ walletPublicConfig: walletPrivateConfig });
    // const acc1AssetVal = await modEthereum.getAssetValue({ walletPublicConfig: walletPrivateConfig, contractAddress });
    // console.log(acc1Balance, acc1AssetVal);

    const endpoint = httpEndpointFromConfig(walletPrivateConfig.networkConfig);
    const gasPrice = 41; // 41 GWei 

    const data = encodeHelper.encodeTxData({ 
      method: 'transfer',
      params: [
        account2.address,
        `0x${(1 * Math.pow(10, 18)).toString(16)}`
      ],
      abi
    });
    
    const gasLimit = parseInt( await ethereumQuery.query({
      method: 'eth_estimateGas', params : [{
        from: account1.address,
        to: contractAddress,
        data
      }], endpoint
    }), 16);
    //console.log(gasLimit);
    const amount = 1;

    const tx = await modEthereum.sendTransaction({
      asset: 'MY',
      amount,
      to: account2.address, 
      gasPrice,
      gasLimit,
      contractAddress,
      walletPrivateConfig 
    });

    const balance = await modEthereum.getAssetValue({ walletPublicConfig: { address: account2.address, networkConfig }, contractAddress });
    //console.log(balance);
    parseFloat(balance.value).should.equal(amount);
    //console.log(account1, account2);
  });

  it('Get Transaction History', async () => {
    const endpoint = httpEndpointFromConfig(networkConfig);
    //const address = '0xCA3fF259F4F2F295772a9cE6d2d65fb90b3a769B';
    const address = '0xF83883FE4866A407e4f035cB6C4b359CfC4e2eeA';
    const res = await modEthereum.getHistory({ address, networkConfig });
  });
  
  it.skip('Get Pending Transaction', async () => {
    const web3 = getWeb3Client(networkConfig);
    const account = await modEthereum.createRandom({ networkConfig });
    const { address } = account;
    const walletPublicConfig = { networkConfig, address };

    const pending1 = await modEthereum.getPending({ walletPublicConfig });
    console.log({ pending1 });

    // Generate new transaction
    const tx = await Genesis.creditAccount({ web3, address, value: modEthereum.toWei(1) });
    //console.log(tx);

    const pending2 = await modEthereum.getPending({ walletPublicConfig });
    //console.log({ pending2 });

    pending1.should.not.contain(tx);
    pending2.should.contain(tx);
    
  });

  it('Get Asset Value', async () => {
    // https://stackoverflow.com/questions/48228662/get-token-balance-with-ethereum-rpc
    const web3 = getWeb3Client(networkConfig);
    const { contractAddress, abi } = await createMyTokenContract({ web3 });
    const { address } = Genesis.createRandomAccount({ web3 });
    const receipt = await Genesis.creditTokens({ web3, contractAddress, abi, to: address, tokens: 3 * Math.pow(10, 18) });

    const walletPublicConfig = { address, networkConfig };

    const res = await modEthereum.getAssetValue({ walletPublicConfig, contractAddress });
    //console.log(JSON.stringify(res));

    // Query with Web3:
    // Balance
    const contractAbi = web3.eth.contract(abi);
    const theContract = contractAbi.at(contractAddress);
    const balance = theContract.balanceOf.call(address);
    // Decimals
    const decimals = parseInt(theContract.decimals.call().toString(), 10);
    const value = balance.toNumber() / Math.pow(10, decimals)
    // Symbol
    const symbol = theContract.symbol();
    // Name
    const name = theContract.name();
    //console.log(value, symbol, name);

    value.should.equal(parseFloat(res.value));
    symbol.should.equal(res.symbol);
    name.should.equal(res.name);
  });

  it('Decode transaction input', async () => {
    const data = '0xa9059cbb000000000000000000000000ad0a2478ba25816365aa0e32d77aff92b9e34efc0000000000000000000000000000000000000000000000a8a892cc27eb500000';
    const res = encodeHelper.decodeTxData({ data });
    res.to.should.equal('0xad0a2478ba25816365aa0e32d77aff92b9e34efc');
    (res.value/Math.pow(10, 18)).should.equal(3111.2);
  });

  it('Encode transaction input', async () => {
    const amount = 3111.2;
    const data = encodeHelper.encodeTxData({ 
      method: 'transfer', 
      params: [ '0xad0a2478ba25816365aa0e32d77aff92b9e34efc', `0x${(amount * Math.pow(10, 18)).toString(16)}` ]
    });
    data.should.equal('0xa9059cbb000000000000000000000000ad0a2478ba25816365aa0e32d77aff92b9e34efc0000000000000000000000000000000000000000000000a8a892cc27eb500000');
  });

  it('Decode contract call response', async () => {
    const data = '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000';
    const res = encodeHelper.decodeTxOutput({ method: 'balanceOf', data });
    (res/Math.pow(10, 18)).should.equal(1);

    const data2 = '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000024d59000000000000000000000000000000000000000000000000000000000000';
    const res2 = encodeHelper.decodeTxOutput({ method: 'symbol', data: data2 });
    res2.should.equal('MY');
    
    const data3 = '0x0000000000000000000000000000000000000000000000000000000000000012';
    const res3 = encodeHelper.decodeTxOutput({ method: 'decimals', data: data3 });
    res3.should.equal('18');
  });

  it('Check that transaction has been recorder to blockchain', async () => {
    const web3 = getWeb3Client(networkConfig);
    const { address } = await modEthereum.createRandom({ networkConfig });
    const walletPublicConfig = { address, networkConfig };
    const amount = 0.1; // eth
    const txid = await Genesis.creditAccount({ web3, address, value: modEthereum.toWei(amount) });
    
    const updated = await modEthereum.isUpdated({ walletPublicConfig, txid });
    updated.should.equal(true);
  });

});
