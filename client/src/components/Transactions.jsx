import React from 'react';
import {connect} from 'react-redux';
import Calendar from './Calendar.jsx';
import TransactionsGraph from './TransactionsGraph.jsx';
import * as transactions from './../actions/transactions.js';

class Transactions extends React.Component {
  constructor(props) {
    super(props);
  }

  componentWillReceiveProps(nextProps) {
    console.log('------------next props here', nextProps)
    if (nextProps.startDate && nextProps.endDate) {
      // send ajax call on updated start and end date
      this.props.dispatch(transactions.getTransactions({
        startDate: nextProps.startDate,
        endDate: nextProps.endDate,
      }));
      // console.log(nextProps.startDate.toISOString().substring(0, 10));
    }
  }

  render() {
    return (
      <div>
        <h3>transactions</h3>
        <Calendar />
        {this.props.startDate && this.props.endDate &&
          <TransactionsGraph />
        }
      </div>
    );
  }
}

export default connect((state) => {
  return {
    transactions: state.transactions.transactions,
    startDate: state.transactions.startDate,
    endDate: state.transactions.endDate,
    fetching: state.transactions.fetching,
    fetched: state.transactions.fetched,
  };
}) (Transactions);