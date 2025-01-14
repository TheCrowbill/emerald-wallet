import '@testing-library/jest-dom/extend-expect';
import { Theme } from '@emeraldwallet/ui';
import { ThemeProvider } from '@material-ui/core';
import { fireEvent, render } from '@testing-library/react';
import * as React from 'react';
import { ImportPrivateKey, styles } from './ImportPrivateKey';

const reduceClasses = (prev: any, curr: any) => ({ ...prev, [curr]: curr });
const classes = Object.keys(styles).reduce(reduceClasses, {});

describe('ImportPrivateKey', () => {
  it('shows error when passwords do not match', () => {
    const comp = render(
      <ThemeProvider theme={Theme}>
        <ImportPrivateKey classes={classes} />
      </ThemeProvider>,
    );
    const confirm = comp.getByPlaceholderText('Confirm Password');
    expect(comp.queryByText('Password must match')).toBeNull();
    fireEvent.change(confirm, { target: { value: 'a' } });

    // assert
    const error = comp.getByText('Password must match');
    expect(error).toHaveTextContent('Password must match');
  });
});
