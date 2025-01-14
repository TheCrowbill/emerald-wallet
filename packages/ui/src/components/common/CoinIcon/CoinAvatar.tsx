import { Avatar, makeStyles, Theme } from '@material-ui/core';
import { createStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import * as React from 'react';
import CoinIcon from './CoinIcon';

const useStyle = makeStyles((theme: Theme) =>
  createStyles({
    btc: {
      backgroundColor: '#f90',
    },
    etc: {
      backgroundColor: '#00c957',
    },
    eth: {
      backgroundColor: '#627eea',
    },
    testbtc: {
      backgroundColor: '#9a7e55',
    },
    center: {
      margin: '0 auto',
    },
    container: {
      display: 'inline-block',
    },
    defaultSize: {
      width: theme.spacing(4),
      height: theme.spacing(4),
    },
    smallSize: {
      width: theme.spacing(3),
      height: theme.spacing(3),
    },
    largeSize: {
      width: theme.spacing(8),
      height: theme.spacing(8),
      fontSize: '3em',
    },
  }),
);

interface OwnProps {
  center?: boolean;
  chain: string;
  className?: string;
  size?: 'default' | 'small' | 'large';
}

const CoinAvatar: React.FC<OwnProps> = ({ center, chain, className, size = 'default' }) => {
  const classes = useStyle();

  return (
    <div className={classNames(classes.container, className)}>
      <Avatar
        className={classNames(
          classes[size + 'Size'],
          classes[chain.toLowerCase()],
          center === true ? classes.center : null,
        )}
      >
        <CoinIcon chain={chain} size={size} />
      </Avatar>
    </div>
  );
};

export default CoinAvatar;
