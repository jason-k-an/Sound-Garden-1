import { combineReducers } from 'redux';
import balance from './balance.js';
import budget from './budget.js';
import creditcards from './creditcards';
import transactions from './transactions.js';

//implement lines below when there are actually other reducers in folder
// import * as reducers from './reducers';
// const appReducer = combineReducers(reducers);

export default combineReducers({
  balance,
  budget,
  creditcards,
  transactions
});