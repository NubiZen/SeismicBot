# Seismic Auto Bot - Airdrop Insiders

A Node.js tool for deploying ERC-20 compatible tokens on the Seismic devnet and automating token transfers to random addresses for testing and airdrop simulations.

## Features

- One-click token deployment on Seismic
- Automated token transfers to multiple addresses
- Real-time transaction status updates
- Simple interactive prompt-based interface
- multi account using proxy
- 
## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A wallet with ETH on Seismic devnet

## Installation

```bash
# Clone the repository
git clone https://github.com/airdropinsiders/Seismic-Auto-Bot.git

# Navigate to the project directory
cd Seismic-Auto-Bot

# Install dependencies
npm install
```

## Configuration

Create a `accounts.txt` file in the root directory with your private key:

```
0x
0x
0x
```


## Usage

Run the tool with:

```bash
node index.js
```

The interactive CLI will guide you through:

1. Token creation random (name, symbol, total 1B)
2. Token deployment to Seismic devnet
3. Optional: Automated token transfers to random addresses

## Token Contract

The script deploys a standard ERC-20 compatible token contract with the following features:

- Token name, symbol, and decimals
- Balance tracking for addresses
- Transfer and approval functionality
- Standard ERC-20 events

## Network Information

The tool connects to:
- Network: Seismic devnet
- Chain ID: 5124
- RPC URL: https://node-2.seismicdev.net/rpc
- Explorer: https://explorer-2.seismicdev.net/

## Contributors

- Airdrop Insiders Team

## License

MIT License

## Support

For any questions or support, please open an issue in this repository or contact the Airdrop Insiders team.