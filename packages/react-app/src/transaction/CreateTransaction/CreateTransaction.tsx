import { BigAmount, FormatterBuilder } from '@emeraldpay/bigamount';
import { Wei } from '@emeraldpay/bigamount-crypto';
import { WalletEntry, isEthereumEntry } from '@emeraldpay/emerald-vault-core';
import {
  AnyCoinCode,
  BlockchainCode,
  Blockchains,
  CurrencyAmount,
  amountFactory,
  blockchainIdToCode,
  formatAmount,
  isAnyTokenCode,
  toBaseUnits,
  toBigNumber,
  tokenAmount,
  workflow,
} from '@emeraldwallet/core';
import { tokenUnits } from '@emeraldwallet/core/lib/blockchains/tokens';
import { registry } from '@emeraldwallet/erc20';
import {
  DEFAULT_FEE,
  FEE_KEYS,
  GasPrices,
  IState,
  accounts,
  hwkey,
  screen,
  settings,
  tokens,
  transaction,
} from '@emeraldwallet/store';
import { Back, Page } from '@emeraldwallet/ui';
import { BigNumber } from 'bignumber.js';
import * as React from 'react';
import { connect } from 'react-redux';
import { traceValidate } from './util';
import { EmeraldDialogs } from '../../app/screen/Dialog';
import ChainTitle from '../../common/ChainTitle';
import CreateTx from '../CreateTx';
import SignTx from '../SignTx';

const DEFAULT_GAS_LIMIT = '21000' as const;
const DEFAULT_ERC20_GAS_LIMIT = '40000' as const;

enum PAGES {
  TX = 1,
  SIGN = 2,
}

type CreateEthereumTx = workflow.CreateEthereumTx;
type CreateERC20Tx = workflow.CreateERC20Tx;

type AnyTransaction = CreateEthereumTx | CreateERC20Tx;

type Request = {
  entryId: string;
  password?: string;
  token: AnyCoinCode;
  transaction: AnyTransaction;
};

interface OwnProps {
  amount?: any;
  data?: any;
  gasLimit?: any;
  sourceEntry: WalletEntry;
  typedData?: any;
}

interface CreateTxState {
  amount?: any;
  data?: any;
  hash?: string;
  page: PAGES;
  password?: string;
  passwordError?: string;
  token: any;
  transaction: any;
  typedData?: any;
  highGasPrice: GasPrices;
  lowGasPrice: GasPrices;
  stdGasPrice: GasPrices;
}

interface DispatchFromProps {
  checkGlobalKey: (password: string) => Promise<boolean>;
  onCancel: () => void;
  signAndSend: (request: Request) => void;
  getFees(blockchain: BlockchainCode): Promise<Record<typeof FEE_KEYS[number], GasPrices>>;
}

interface Props {
  allTokens?: any;
  amount: any;
  chain: BlockchainCode;
  currency: string;
  data: any;
  eip1559: boolean;
  fiatRate?: any;
  from?: any;
  gasLimit: any;
  mode?: string;
  ownAddresses: string[];
  selectedFromAddress: string;
  to?: any;
  token: any;
  tokenSymbols: string[];
  txFeeSymbol: string;
  typedData: any;
  useLedger: boolean;
  value?: any;
  getBalance: (address: string) => Wei;
  getBalancesByAddress: (address: string) => string[];
  getEntryByAddress: (address: string) => WalletEntry | undefined;
  getFiatForAddress: (address: string, token: AnyCoinCode) => string;
  getTokenBalanceForAddress: (address: string, token: AnyCoinCode) => BigAmount;
}

function isToken(tx: AnyTransaction): tx is CreateERC20Tx {
  return isAnyTokenCode(tx.getTokenSymbol().toUpperCase());
}

const { TxTarget } = workflow;

class CreateTransaction extends React.Component<OwnProps & Props & DispatchFromProps, CreateTxState> {
  constructor(props: OwnProps & Props & DispatchFromProps) {
    super(props);
    this.onChangeFrom = this.onChangeFrom.bind(this);
    this.onChangeTo = this.onChangeTo.bind(this);
    this.onChangeToken = this.onChangeToken.bind(this);
    this.onChangeGasLimit = this.onChangeGasLimit.bind(this);
    this.onSubmitCreateTransaction = this.onSubmitCreateTransaction.bind(this);
    this.onSubmitSignTxForm = this.onSubmitSignTxForm.bind(this);
    this.onChangeAmount = this.onChangeAmount.bind(this);
    this.onChangePassword = this.onChangePassword.bind(this);
    this.getPage = this.getPage.bind(this);
    this.onMaxClicked = this.onMaxClicked.bind(this);
    this.onSetMaxGasPrice = this.onSetMaxGasPrice.bind(this);
    this.onSetPriorityGasPrice = this.onSetPriorityGasPrice.bind(this);
    const tx = CreateTransaction.txFromProps(props);
    this.state = {
      highGasPrice: DEFAULT_FEE,
      lowGasPrice: DEFAULT_FEE,
      stdGasPrice: DEFAULT_FEE,
      page: props.mode ? PAGES.SIGN : PAGES.TX,
      token: props.token,
      transaction: tx.dump(),
    };
  }

  get balance() {
    if (isToken(this.transaction)) {
      return this.props.getTokenBalanceForAddress(this.transaction.from!, this.state.token);
    } else {
      return this.props.getBalance(this.transaction.from!);
    }
  }

  get transaction(): AnyTransaction {
    const currentChain = Blockchains[this.props.chain];
    const {
      token,
      transaction: { tokenSymbol: transactionToken },
    } = this.state;
    let { amount } = this.state.transaction;

    if (currentChain.params.coinTicker !== token) {
      if (token !== transactionToken) {
        const amountValue = Wei.decode(amount).toEther().valueOf();
        amount = new BigAmount(amountValue, tokenUnits(token)).encode();
      }
      return workflow.CreateERC20Tx.fromPlain({ ...this.state.transaction, amount, tokenSymbol: token });
    }

    if (token !== transactionToken && transactionToken != 'ETH') {
      const amountValue = BigAmount.decode(amount, tokenUnits(transactionToken)).number.toNumber();
      amount = new Wei(amountValue, 'ETHER').encode();
    }

    return workflow.CreateEthereumTx.fromPlain({ ...this.state.transaction, amount });
  }

  set transaction(tx) {
    this.setState({ transaction: tx.dump() });
  }

  public static txFromProps(props: OwnProps & Props & DispatchFromProps) {
    const tx = new workflow.CreateEthereumTx(null, props.eip1559);
    tx.from = props.selectedFromAddress;
    tx.setTotalBalance(props.getBalance(props.selectedFromAddress));
    tx.maxGasPrice = new Wei(0);
    tx.priorityGasPrice = new Wei(0);
    tx.amount = props.amount;
    tx.gas = new BigNumber(props.gasLimit || DEFAULT_GAS_LIMIT);
    return tx;
  }

  public onChangeFrom = (from: string): void => {
    if (from == null) {
      return;
    }

    const tx = this.transaction;

    if (isToken(tx)) {
      const balance = this.props.getTokenBalanceForAddress(from, this.state.token);

      tx.setTotalBalance(balance);
    } else {
      const balance = this.props.getBalance(from);

      tx.setTotalBalance(balance);
    }

    tx.from = from;
    tx.rebalance();

    this.transaction = tx;
  };

  public onChangeTo = (to: string) => {
    const tx = this.transaction;
    tx.to = to;
    this.transaction = tx;
  };

  public onChangeToken = (tokenSymbol: any) => {
    const { getBalance } = this.props;
    this.setState({ token: tokenSymbol });

    const tx = this.restoreTx(tokenSymbol);

    if (isToken(tx)) {
      const tokenInfo = registry.bySymbol(this.props.chain, tokenSymbol);
      if (tokenInfo) {
        // Adjust Gas Limit
        tx.gas = BigNumber.max(tx.gas, new BigNumber(DEFAULT_ERC20_GAS_LIMIT));
        tx.totalEtherBalance = getBalance(tx.from!);
        tx.setAmount(tokenAmount(0, tokenInfo.symbol), tokenSymbol);
      }
      const balance = this.props.getTokenBalanceForAddress(tx.from!, tokenSymbol);
      tx.setTotalBalance(balance);
    } else {
      // Gas for ordinary transaction
      tx.gas = BigNumber.max(tx.gas, new BigNumber(DEFAULT_GAS_LIMIT));
      tx.setAmount(Wei.ZERO);
      const balance = this.props.getBalance(tx.from!);
      tx.setTotalBalance(balance);
    }
    this.transaction = tx;
  };

  public onChangePassword = (password: string) => {
    this.setState({ password });
  };

  public onChangeGasLimit = (value: string) => {
    const tx = this.transaction;
    tx.gas = new BigNumber(value || DEFAULT_GAS_LIMIT);
    this.transaction = tx;
  };

  public onChangeAmount = (amount: BigAmount) => {
    if (!BigAmount.is(amount)) {
      console.warn('Not a BigAmount', amount);
    }
    const tx = this.transaction;
    if (isToken(tx)) {
      tx.setAmount(amount, tx.tokenSymbol);
    } else if (Wei.is(amount)) {
      tx.setAmount(amount);
    } else {
      console.log('Invalid amount type', amount.toString());
    }
    tx.target = TxTarget.MANUAL;
    this.transaction = tx;
  };

  public async componentDidMount() {
    const fees = await this.props.getFees(this.props.chain);

    const { avgLast, avgMiddle, avgTail5 } = fees;
    const tx = this.transaction;

    if (this.props.eip1559) {
      tx.gasPrice = undefined;
      tx.maxGasPrice = new Wei(avgTail5.max);
      tx.priorityGasPrice = new Wei(avgTail5.priority);
    } else {
      tx.gasPrice = new Wei(avgTail5.expect);
      tx.maxGasPrice = undefined;
      tx.priorityGasPrice = undefined;
    }

    tx.rebalance();

    this.transaction = tx;

    this.setState({
      highGasPrice: avgMiddle,
      lowGasPrice: avgLast,
      stdGasPrice: avgTail5,
      amount: this.props.amount,
      data: this.props.data,
      token: this.props.token,
      transaction: tx.dump(),
      typedData: this.props.typedData,
    });
  }

  public onSubmitCreateTransaction = () => {
    this.setState({
      page: PAGES.SIGN,
    });
  };

  public onSubmitSignTxForm = async () => {
    this.setState({ passwordError: undefined });

    if (this.transaction.from == null) {
      return;
    }

    const correctPassword = await this.props.checkGlobalKey(this.state.password ?? '');

    if (correctPassword) {
      const entry = this.props.getEntryByAddress(this.transaction.from);

      if (entry == null || !isEthereumEntry(entry)) {
        return;
      }

      this.props.signAndSend({
        entryId: entry.id,
        password: this.state.password,
        transaction: this.transaction,
        token: this.state.token,
      });
    } else {
      this.setState({ passwordError: 'Incorrect password' });
    }
  };

  public onMaxClicked() {
    const tx = this.transaction;
    tx.target = TxTarget.SEND_ALL;
    tx.rebalance();
    this.transaction = tx;
  }

  public onSetMaxGasPrice(price: number) {
    const tx = this.transaction;

    const gasPrice = new Wei(price, 'GWei');

    if (this.props.eip1559) {
      tx.gasPrice = undefined;
      tx.maxGasPrice = gasPrice;
    } else {
      tx.gasPrice = gasPrice;
      tx.maxGasPrice = undefined;
    }

    tx.rebalance();

    this.transaction = tx;
  }

  public onSetPriorityGasPrice(price: number) {
    const tx = this.transaction;
    tx.priorityGasPrice = new Wei(price, 'GWei');
    tx.rebalance();
    this.transaction = tx;
  }

  public getPage() {
    if (!this.state.transaction.from) {
      return null;
    }
    const tx = this.transaction;
    switch (this.state.page) {
      case PAGES.TX:
        return (
          <CreateTx
            chain={this.props.chain}
            eip1559={this.props.eip1559}
            highGasPrice={this.state.highGasPrice}
            lowGasPrice={this.state.lowGasPrice}
            stdGasPrice={this.state.stdGasPrice}
            tx={tx}
            txFeeToken={this.props.txFeeSymbol}
            token={this.state.token}
            fiatBalance={this.props.getFiatForAddress(tx.from!, this.state.token)}
            currency={this.props.currency}
            tokenSymbols={this.props.tokenSymbols}
            ownAddresses={this.props.ownAddresses}
            onChangeFrom={this.onChangeFrom}
            onChangeToken={this.onChangeToken}
            onChangeGasLimit={this.onChangeGasLimit}
            onChangeAmount={this.onChangeAmount}
            onChangeTo={this.onChangeTo}
            onSubmit={this.onSubmitCreateTransaction}
            onCancel={this.props.onCancel}
            onMaxClicked={this.onMaxClicked}
            onSetMaxGasPrice={this.onSetMaxGasPrice}
            onSetPriorityGasPrice={this.onSetPriorityGasPrice}
            getBalancesByAddress={this.props.getBalancesByAddress}
          />
        );
      case PAGES.SIGN:
        return (
          <SignTx
            passwordError={this.state.passwordError}
            fiatRate={this.props.fiatRate}
            tx={tx}
            onChangePassword={this.onChangePassword}
            useLedger={this.props.useLedger}
            typedData={this.state.typedData}
            onSubmit={this.onSubmitSignTxForm}
            mode={this.props.mode}
            onCancel={this.props.onCancel}
          />
        );
      default:
        return null;
    }
  }

  public render() {
    const { chain } = this.props;
    return (
      <Page
        title={<ChainTitle chain={chain} text={'Create Transaction'} />}
        leftIcon={<Back onClick={this.props.onCancel} />}
      >
        {this.getPage()}
      </Page>
    );
  }

  private restoreTx(tokenSymbol: any) {
    const currentChain = Blockchains[this.props.chain];

    if (currentChain.params.coinTicker !== tokenSymbol) {
      return workflow.CreateERC20Tx.fromPlain({
        ...this.state.transaction,
        tokenSymbol,
        amount: new BigAmount(0, tokenUnits(tokenSymbol)).encode(),
        totalEtherBalance: undefined,
        totalTokenBalance: undefined,
      });
    }

    return workflow.CreateEthereumTx.fromPlain({
      ...this.state.transaction,
      amount: Wei.ZERO.encode(),
      totalEtherBalance: undefined,
      totalTokenBalance: undefined,
    });
  }
}

function signTokenTx(dispatch: any, ownProps: OwnProps, { entryId, password, token, transaction: tx }: Request) {
  if (password == null || tx.to == null || tx.from == null) {
    return;
  }

  const blockchainCode = blockchainIdToCode(ownProps.sourceEntry.blockchain);

  const tokenInfo = registry.bySymbol(blockchainCode, token);
  const tokenUnits = toBaseUnits(toBigNumber(tx.amount.number), tokenInfo.decimals);

  const txData = tokens.actions.createTokenTxData(tx.to, tokenUnits, true);

  return dispatch(
    transaction.actions.signTransaction(
      entryId,
      blockchainCode,
      tx.from,
      password,
      tokenInfo.address,
      tx.gas.toNumber(),
      Wei.ZERO,
      txData,
      tx.gasPrice,
      tx.maxGasPrice,
      tx.priorityGasPrice,
    ),
  );
}

function signEtherTx(dispatch: any, ownProps: OwnProps, { entryId, password, transaction: tx }: Request) {
  if (tx.to == null || tx.from == null || !Wei.is(tx.amount)) {
    console.warn('Invalid tx', tx.to, tx.from, tx.amount);
    return;
  }

  const blockchainCode = blockchainIdToCode(ownProps.sourceEntry.blockchain);

  const plainTx = {
    from: tx.from,
    gas: tx.gas,
    to: tx.to,
    value: tx.amount,
  };

  const isHardware = password == null;

  const validated = traceValidate(blockchainCode, plainTx, dispatch, transaction.actions.estimateGas);
  let prepared: Promise<any>;
  if (isHardware) {
    prepared = validated
      .then(() => dispatch(hwkey.actions.setWatch(false)))
      .then(() => dispatch(screen.actions.showDialog(EmeraldDialogs.SIGN_TX)));
  } else {
    prepared = validated;
  }

  return prepared.then(() =>
    dispatch(
      transaction.actions.signTransaction(
        entryId,
        blockchainCode,
        tx.from!!,
        password || '',
        tx.to!!,
        tx.gas.toNumber(),
        tx.amount!! as Wei,
        '',
        tx.gasPrice,
        tx.maxGasPrice,
        tx.priorityGasPrice,
      ),
    ),
  );
}

function sign(dispatch: any, ownProps: OwnProps, request: Request) {
  const blockchain = Blockchains[blockchainIdToCode(ownProps.sourceEntry.blockchain)];
  const token = request.token.toUpperCase();
  const { coinTicker } = blockchain.params;

  if (token === coinTicker) {
    return signEtherTx(dispatch, ownProps, request);
  }

  return signTokenTx(dispatch, ownProps, request);
}

const fiatFormatter = new FormatterBuilder().useTopUnit().number(2).build();

export default connect(
  (state: IState, ownProps: OwnProps): Props => {
    const { sourceEntry } = ownProps;

    const blockchainCode = blockchainIdToCode(sourceEntry.blockchain);
    const blockchain = Blockchains[blockchainCode];
    const txFeeSymbol = blockchain.params.coinTicker;
    const zero = amountFactory(blockchain.params.code)(0);

    const allTokens = registry.tokens[blockchain.params.code]
      .concat([{ address: '', symbol: txFeeSymbol, decimals: blockchain.params.decimals }])
      .reverse();

    const getEntryByAddress = (address: string): WalletEntry | undefined =>
      accounts.selectors.findAccountByAddress(state, address, blockchainCode);

    return {
      allTokens,
      getEntryByAddress,
      amount: ownProps.amount || Wei.ZERO,
      chain: blockchain.params.code,
      currency: settings.selectors.fiatCurrency(state),
      data: ownProps.data,
      eip1559: blockchain.params.eip1559 ?? false,
      gasLimit: ownProps.gasLimit || DEFAULT_GAS_LIMIT,
      ownAddresses:
        accounts.selectors
          .findWalletByEntryId(state, sourceEntry.id)
          ?.entries.filter((entry) => !entry.receiveDisabled)
          .reduce<Array<string>>(
            (carry, entry) =>
              entry.blockchain === sourceEntry.blockchain && entry.address != null
                ? [...carry, entry.address.value]
                : carry,
            [],
          ) ?? [],
      selectedFromAddress: sourceEntry.address!.value,
      token: blockchain.params.coinTicker,
      tokenSymbols: allTokens.map((i) => i.symbol),
      txFeeSymbol,
      typedData: ownProps.typedData,
      useLedger: false, // TODO
      getBalance: (address: string): Wei => {
        const entry = getEntryByAddress(address);

        if (entry == null || !isEthereumEntry(entry)) {
          return new Wei(zero);
        }

        return new Wei(accounts.selectors.getBalance(state, entry.id, zero)!.number);
      },
      getBalancesByAddress(address) {
        const entry = getEntryByAddress(address);

        if (entry == null || !isEthereumEntry(entry)) {
          return [];
        }

        const balance = accounts.selectors.getBalance(state, entry.id, zero) ?? zero;
        const tokensBalances = tokens.selectors.selectBalances(state, address, blockchainCode) ?? [];

        return [balance, ...tokensBalances].map(formatAmount);
      },
      getFiatForAddress: (address: string, token: AnyCoinCode): string => {
        if (token !== txFeeSymbol) {
          return '??';
        }

        const entry = getEntryByAddress(address);

        if (entry == null || !isEthereumEntry(entry)) {
          return fiatFormatter.format(zero);
        }

        const newBalance = accounts.selectors.getBalance(state, entry.id, zero)!;
        const rate = settings.selectors.fiatRate(token, state) ?? 0;
        const fiat = CurrencyAmount.create(
          newBalance.getNumberByUnit(newBalance.units.top).multipliedBy(rate).toNumber(),
          settings.selectors.fiatCurrency(state),
        );

        return fiatFormatter.format(fiat);
      },
      getTokenBalanceForAddress: (address: string, token: AnyCoinCode): BigAmount => {
        const tokenInfo = registry.bySymbol(blockchain.params.code, token);

        return (
          tokens.selectors.selectBalance(state, tokenInfo.address, address, blockchain.params.code) ??
          tokenAmount(0, token)
        );
      },
    };
  },

  (dispatch: any, ownProps: OwnProps): DispatchFromProps => ({
    getFees: (blockchain) => {
      return dispatch(transaction.actions.getFee(blockchain));
    },
    onCancel: () => {
      dispatch(screen.actions.goBack());
    },
    signAndSend: (request) => {
      sign(dispatch, ownProps, request).then((result: any) => {
        if (result) {
          dispatch(screen.actions.gotoScreen(screen.Pages.BROADCAST_TX, result));
        }
      });
    },
    checkGlobalKey(password) {
      return dispatch(accounts.actions.verifyGlobalKey(password));
    },
  }),
)(CreateTransaction);
