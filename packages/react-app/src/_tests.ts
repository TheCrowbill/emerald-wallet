import { IState } from '@emeraldwallet/store';
import { Store } from 'redux';

export function createTestStore(state?: Partial<IState>): Store {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Symbol.observable](): any {
      return undefined;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch(): any {
      return () => undefined;
    },
    getState() {
      return state;
    },
    replaceReducer(): void {
      // Nothing
    },
    subscribe() {
      return () => undefined;
    }
  };
}
