module.exports = {
  BTC: {
    // USE THIS KIND OF MOCK SO FAR.
    // Closer to production, we will use 
    value: 'BTC', 
    name: 'Bitcoin',
    icon: '/networks/BTC.png',
    testnet: true, 
    //networkId: 'REGTEST',
    // rpcRoot: 'http://localhost:18443' // only if networkId is absent
    networkId: 'REGTEST',
    rpc: 'http://admin1:123@localhost:19001',
    api: 'tcp://127.0.0.1:50001',

  }
}