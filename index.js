const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const solc = require("solc");
const crypto = require("crypto");
const HttpsProxyAgent = require("https-proxy-agent");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

const tokenContractSource = `
pragma solidity ^0.8.13;

contract SeismicToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _totalSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply * 10**uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(value <= balanceOf[from], "Insufficient balance");
        require(value <= allowance[from][msg.sender], "Insufficient allowance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}
`;

function saveContractToFile(contractSource, filename) {
  const filePath = path.join(__dirname, filename);
  fs.writeFileSync(filePath, contractSource);
  return filePath;
}

function compileContract(contractPath, contractName) {
  const contractSource = fs.readFileSync(contractPath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [path.basename(contractPath)]: { content: contractSource } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
      optimizer: { enabled: true, runs: 200 }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors && output.errors.filter(e => e.severity === 'error').length > 0) {
    throw new Error(`Compilation errors: ${JSON.stringify(output.errors, null, 2)}`);
  }
  const compiledContract = output.contracts[path.basename(contractPath)][contractName];
  return { abi: compiledContract.abi, bytecode: compiledContract.evm.bytecode.object };
}

function generateRandomAddress() {
  const privateKey = "0x" + crypto.randomBytes(32).toString('hex');
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

function loadAccounts() {
  try {
    const accounts = fs.readFileSync("accounts.txt", "utf8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("0x") && line.length === 66);
    if (accounts.length === 0) {
      throw new Error("File accounts.txt kosong atau tidak ada kunci privat yang valid");
    }
    return accounts;
  } catch (error) {
    console.error(`${colors.red}❌ Gagal memuat akun: ${error.message}. Harap siapkan file accounts.txt${colors.reset}`);
    process.exit(1);
  }
}

function loadProxies() {
  try {
    const proxies = fs.readFileSync("proxy.txt", "utf8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
    return proxies.length > 0 ? proxies : [];
  } catch (error) {
    console.log(`${colors.yellow}⚠ Tidak ada proxy.txt atau kosong, berjalan tanpa proxy${colors.reset}`);
    return [];
  }
}

function generateRandomName() {
  const prefixes = ["Seismic", "Airdrop", "Crypto", "Luna", "Nova", "Stellar"];
  const suffixes = ["Coin", "Token", "Cash", "Pay", "Bit", "X"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix}${suffix}`;
}

function generateRandomSymbol() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let symbol = "";
  for (let i = 0; i < 3; i++) {
    symbol += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return symbol;
}

function displaySection(title) {
  console.log("\n" + colors.cyan + colors.bright + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
  console.log(colors.cyan + " 🚀 " + title + colors.reset);
  console.log(colors.cyan + colors.bright + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
}

async function checkEthBalances(accounts, provider) {
  console.log(`\n${colors.cyan}🔍 Memeriksa saldo ETH semua wallet:${colors.reset}`);
  for (let i = 0; i < accounts.length; i++) {
    const wallet = new ethers.Wallet(accounts[i]);
    const balance = await provider.getBalance(wallet.address);
    console.log(`👛 Wallet ${i + 1} (${wallet.address}): ${colors.yellow}${ethers.utils.formatEther(balance)} ETH${colors.reset}`);
  }
}

async function checkTokenBalances(deployments, provider) {
  if (deployments.length === 0) return;
  console.log(`\n${colors.cyan}🔍 Memeriksa saldo token semua wallet:${colors.reset}`);
  for (let i = 0; i < deployments.length; i++) {
    const { contractAddress, abi, tokenName, tokenSymbol, account } = deployments[i];
    const wallet = new ethers.Wallet(account, provider);
    const tokenContract = new ethers.Contract(contractAddress, abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log(`👛 Wallet ${i + 1} (${wallet.address}): ${colors.yellow}${ethers.utils.formatEther(balance)} ${tokenSymbol} (${tokenName})${colors.reset}`);
  }
}

async function deployTokenContract(tokenName, tokenSymbol, totalSupply, privateKey, proxy = null) {
  try {
    if (!privateKey) throw new Error("Private key tidak ditemukan");

    displaySection("DEPLOYING TOKEN CONTRACT");
    console.log(`📝 Token Name: ${colors.yellow}${tokenName}${colors.reset}`);
    console.log(`🔤 Token Symbol: ${colors.yellow}${tokenSymbol}${colors.reset}`);
    console.log(`💰 Total Supply: ${colors.yellow}${totalSupply}${colors.reset}`);
    console.log(`🌐 Network: ${colors.yellow}Seismic devnet (Chain ID: 5124)${colors.reset}`);
    if (proxy) console.log(`🌐 Proxy: ${colors.yellow}${proxy}${colors.reset}`);

    const providerConfig = proxy ? {
      url: "https://node-2.seismicdev.net/rpc",
      agent: new HttpsProxyAgent(proxy)
    } : "https://node-2.seismicdev.net/rpc";
    const provider = new ethers.providers.JsonRpcProvider(providerConfig);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`👛 Deployer: ${colors.yellow}${wallet.address}${colors.reset}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`💎 Wallet Balance: ${colors.yellow}${ethers.utils.formatEther(balance)} ETH${colors.reset}`);

    if (balance.eq(0)) throw new Error("Dompet tidak memiliki ETH untuk biaya transaksi");

    const contractPath = saveContractToFile(tokenContractSource, "SeismicToken.sol");
    console.log(`📄 Kontrak disimpan ke: ${colors.yellow}${contractPath}${colors.reset}`);
    
    const { abi, bytecode } = compileContract(contractPath, "SeismicToken");
    console.log(`${colors.green}✅ Kontrak berhasil dikompilasi${colors.reset}`);

    const factory = new ethers.ContractFactory(abi, "0x" + bytecode, wallet);
    
    console.log(`⏳ Memulai deployment...`);
    const contract = await factory.deploy(tokenName, tokenSymbol, totalSupply, { gasLimit: 3000000 });
    
    console.log(`🔄 Hash transaksi: ${colors.yellow}${contract.deployTransaction.hash}${colors.reset}`);
    console.log(`⏳ Menunggu konfirmasi...`);
    await contract.deployTransaction.wait();
    
    console.log(`\n${colors.green}✅ Kontrak Token berhasil dideploy!${colors.reset}`);
    console.log(`📍 Alamat kontrak: ${colors.yellow}${contract.address}${colors.reset}`);
    console.log(`🔍 Lihat di explorer: ${colors.yellow}https://explorer-2.seismicdev.net/address/${contract.address}${colors.reset}`);
    
    return { contractAddress: contract.address, abi: abi, tokenName, tokenSymbol };
  } catch (error) {
    console.error(`${colors.red}❌ Gagal deploy kontrak: ${error.message}${colors.reset}`);
    throw error;
  }
}

async function transferTokens(contractAddress, abi, numTransfers, amountPerTransfer, privateKey, proxy = null, tokenSymbol) {
  try {
    displaySection("TRANSFERRING TOKENS");
    console.log(`📊 Jumlah transfer: ${colors.yellow}${numTransfers}${colors.reset}`);
    console.log(`💸 Jumlah per transfer: ${colors.yellow}${amountPerTransfer} ${tokenSymbol}${colors.reset}`);
    console.log(`🎯 Alamat kontrak: ${colors.yellow}${contractAddress}${colors.reset}`);
    if (proxy) console.log(`🌐 Proxy: ${colors.yellow}${proxy}${colors.reset}`);

    const providerConfig = proxy ? {
      url: "https://node-2.seismicdev.net/rpc",
      agent: new HttpsProxyAgent(proxy)
    } : "https://node-2.seismicdev.net/rpc";
    const provider = new ethers.providers.JsonRpcProvider(providerConfig);
    const wallet = new ethers.Wallet(privateKey, provider);
    const tokenContract = new ethers.Contract(contractAddress, abi, wallet);
    
    console.log(`\n${colors.cyan}📤 Memulai transfer...${colors.reset}`);
    
    console.log("\n" + colors.cyan + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
    console.log(`${colors.bright}  #  | Alamat Penerima                              | Jumlah         | Status${colors.reset}`);
    console.log(colors.cyan + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
    
    for (let i = 0; i < numTransfers; i++) {
      const recipient = generateRandomAddress();
      const formattedAmount = ethers.utils.parseUnits(amountPerTransfer.toString(), 18);
      
      try {
        const tx = await tokenContract.transfer(recipient, formattedAmount);
        process.stdout.write(`  ${i + 1}`.padEnd(4) + "| " + 
            `${recipient}`.padEnd(45) + "| " + 
            `${amountPerTransfer} ${tokenSymbol}`.padEnd(15) + "| " + 
            `${colors.yellow}Pending...${colors.reset}`);
        
        await tx.wait();
        process.stdout.clearLine ? process.stdout.clearLine() : null;
        process.stdout.cursorTo ? process.stdout.cursorTo(0) : null;
        console.log(`  ${i + 1}`.padEnd(4) + "| " + 
            `${recipient}`.padEnd(45) + "| " + 
            `${amountPerTransfer} ${tokenSymbol}`.padEnd(15) + "| " + 
            `${colors.green}✅ Sukses${colors.reset}`);
      } catch (error) {
        process.stdout.clearLine ? process.stdout.clearLine() : null;
        process.stdout.cursorTo ? process.stdout.cursorTo(0) : null;
        console.log(`  ${i + 1}`.padEnd(4) + "| " + 
            `${recipient}`.padEnd(45) + "| " + 
            `${amountPerTransfer} ${tokenSymbol}`.padEnd(15) + "| " + 
            `${colors.red}❌ Gagal${colors.reset}`);
      }
    }
    
    console.log(colors.cyan + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
    console.log(`\n${colors.green}✅ Operasi transfer selesai${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Gagal transfer token: ${error.message}${colors.reset}`);
    throw error;
  }
}

function showMenu() {
  console.log("\n" + colors.cyan + colors.bright + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
  console.log(colors.cyan + colors.bright + "       SEISMIC TOKEN AUTO BOT - AIRDROP INSIDERS           " + colors.reset);
  console.log(colors.cyan + colors.bright + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
  console.log(`${colors.yellow}🌐 Network: Seismic devnet (Chain ID: 5124)${colors.reset}`);
  console.log("\n" + colors.yellow + "MENU PILIHAN:" + colors.reset);
  console.log("1. Deploy Token Baru (Nama & Simbol Acak per Wallet)");
  console.log("2. Transfer Token ke Alamat Acak");
  console.log("3. Keluar");
  console.log(colors.cyan + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" + colors.reset);
}

async function main() {
  const accounts = loadAccounts();
  const proxies = loadProxies();
  const TOTAL_SUPPLY = 100000000; // Total pasokan tetap 100 juta
  let deployments = []; // Deklarasi di luar askMenu agar bisa diakses di semua opsi

  const provider = new ethers.providers.JsonRpcProvider("https://node-2.seismicdev.net/rpc");

  // Cek saldo ETH semua wallet di awal
  await checkEthBalances(accounts, provider);

  console.log(`\n${colors.yellow}👥 Jumlah akun yang digunakan: ${accounts.length}${colors.reset}`);
  console.log(`${colors.yellow}🌐 Jumlah proxy yang tersedia: ${proxies.length}${colors.reset}`);

  async function askMenu() {
    showMenu();
    rl.question(`${colors.yellow}Pilih opsi (1-3): ${colors.reset}`, async (choice) => {
      switch (choice) {
        case "1":
          deployments = []; // Reset deployments sebelum deploy baru
          for (let i = 0; i < accounts.length; i++) {
            const tokenName = generateRandomName(); // Nama acak per wallet
            const tokenSymbol = generateRandomSymbol(); // Simbol acak per wallet
            const proxy = proxies[i] || null;
            console.log(`\n${colors.cyan}🔄 Memproses akun ${i + 1}/${accounts.length}${colors.reset}`);
            console.log(`${colors.yellow}📝 Nama token yang dihasilkan: ${tokenName}${colors.reset}`);
            console.log(`${colors.yellow}🔤 Simbol token yang dihasilkan: ${tokenSymbol}${colors.reset}`);
            try {
              const result = await deployTokenContract(tokenName, tokenSymbol, TOTAL_SUPPLY, accounts[i], proxy);
              deployments.push({ account: accounts[i], ...result });
            } catch (error) {
              console.error(`${colors.red}❌ Gagal deploy untuk akun ${i + 1}: ${error.message}${colors.reset}`);
            }
          }
          console.log(`\n${colors.green}🎉 Penyebaran token selesai!${colors.reset}`);
          await checkTokenBalances(deployments, provider); // Cek saldo token setelah deploy
          askMenu();
          break;

        case "2":
          if (deployments.length === 0) {
            console.error(`${colors.red}❌ Belum ada token yang dideploy. Deploy dulu di opsi 1!${colors.reset}`);
            askMenu();
            return;
          }
          await checkTokenBalances(deployments, provider); // Cek saldo token sebelum transfer
          rl.question(`${colors.yellow}📊 Masukkan jumlah transfer per akun: ${colors.reset}`, (numTransfers) => {
            rl.question(`${colors.yellow}💸 Masukkan jumlah per transfer: ${colors.reset}`, async (amountPerTransfer) => {
              const transfers = parseInt(numTransfers);
              const amount = parseFloat(amountPerTransfer);

              if (isNaN(transfers) || transfers <= 0) {
                console.error(`${colors.red}❌ Jumlah transfer harus angka positif${colors.reset}`);
                askMenu();
                return;
              }
              if (isNaN(amount) || amount <= 0) {
                console.error(`${colors.red}❌ Jumlah harus angka positif${colors.reset}`);
                askMenu();
                return;
              }

              for (let i = 0; i < deployments.length; i++) {
                const { contractAddress, abi, account, tokenName, tokenSymbol } = deployments[i];
                const proxy = proxies[i] || null;
                console.log(`\n${colors.cyan}🔄 Memproses transfer untuk akun ${i + 1}/${deployments.length} (Token: ${tokenName} - ${tokenSymbol})${colors.reset}`);
                await transferTokens(contractAddress, abi, transfers, amount, account, proxy, tokenSymbol);
              }
              console.log(`\n${colors.green}🎉 Semua transfer selesai!${colors.reset}`);
              await checkTokenBalances(deployments, provider); // Cek saldo token setelah transfer
              askMenu();
            });
          });
          break;

        case "3":
          console.log(`${colors.green}👋 Keluar dari program${colors.reset}`);
          rl.close();
          break;

        default:
          console.error(`${colors.red}❌ Pilihan tidak valid. Pilih 1-3!${colors.reset}`);
          askMenu();
      }
    });
  }

  await askMenu();
}

main().catch(error => {
  console.error(`${colors.red}❌ Terjadi error pada program: ${error.message}${colors.reset}`);
  rl.close();
});