import BigNumber from 'bignumber.js';
import { BlockchainCode } from '../blockchains';

export interface EthereumRawTransaction {
  blockHash?: string;
  blockNumber?: string;
  from: string;
  gas: string;
  gasPrice?: string;
  maxGasPrice?: string;
  priorityGasPrice?: string;
  hash: string;
  input: string;
  nonce: string;
  to?: string;
  transactionIndex: string;
  value: string;
  v: string;
  r: string;
  s: string;
}

export interface EthereumTransaction {
  blockchain: BlockchainCode;
  blockNumber?: number;
  from: string;
  gas: number | string;
  gasPrice?: string | BigNumber;
  maxGasPrice?: string | BigNumber;
  priorityGasPrice?: string | BigNumber;
  hash?: string;
  data: string;
  nonce: number | string;
  to?: string;
  value: string | BigNumber;
}

export interface EthereumRawReceipt {
  blockHash: string;
  blockNumber: string;
  contractAddress?: string;
  cumulativeGasUsed: string;
  effectiveGasPrice?: string;
  from: string;
  gasUsed: string;
  logs: unknown[];
  logsBloom: string;
  root: string;
  status: string;
  to?: string;
  transactionHash: string;
  transactionIndex: string;
}

export interface EthereumReceipt {
  blockHash: string;
  blockNumber: number;
  contractAddress?: string;
  cumulativeGasUsed: number;
  effectiveGasPrice?: number;
  from: string;
  gasUsed: number;
  logs: unknown[];
  logsBloom: string;
  root: string;
  status: number;
  to?: string;
  transactionHash: string;
  transactionIndex: number;
}
