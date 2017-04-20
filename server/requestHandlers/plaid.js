var plaid = require('plaid');
var Promise = require('bluebird');
var db = require('./../../database/index.js');
var PLAID_CLIENT_ID  = process.env.PLAID_clientID;
var PLAID_SECRET     = process.env.PLAID_clientSecret;
var PLAID_PUBLIC_KEY = process.env.PLAID_publicKey;
var PLAID_ENV        = process.env.PLAID_env;

var client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  // TODO: adjust environment as product life cycle advances
  plaid.environments[PLAID_ENV]
);

module.exports.accessToken = function(req, res) {
  var PUBLIC_TOKEN = req.body.public_token;
  client.exchangePublicToken(PUBLIC_TOKEN, function(err, tokenResponse) {
    if (err) {
      console.log('could not exchange public token', error);
      return res.json({error: 'could not exchange public token'});
    }
    var ACCESS_TOKEN = tokenResponse.access_token;
    var institutionName = req.body.metadata.institution.name;
    var userid = req.session.passport.user.id;
    db.updatePlaidItem([ACCESS_TOKEN, institutionName, userid], function(err, response) {
      // TODO: -------------------- never adds more than one row in current state
      if (err) {
        console.log('error updating plaid item');
        return res.status(500).send(error);
      }
      
      if (response === 0) {
        db.insertPlaidItem([userid, ACCESS_TOKEN, institutionName], function(err, response) {
          if (err) {
            console.log('error inserting plaid item');
            return res.json({error: 'error inserting plaid item'});
          }    
          return res.json({error: false});
        });
      } else {
        return res.json({error: false});
      }
    });
  });
};

module.exports.accounts = function(req, res) {
  var userid = req.session.passport.user.id;
  var promises = [];
  var accountData = {};
  var plaidInstitutions = [];
  db.getPlaidItems(userid, function(err, response) {
    plaidInstitutions = response;
    for (let i = 0; i < response.length; i++) {
      promises.push(client.getAccounts(response[i].access_token)
        .then(function(data) {
          data.accounts.forEach(function(account) {
            account.institution_name = response[i].institution_name
          });
          return data.accounts;
        })
        .catch(function(error) {
          return error;
        })
      );
    }

    Promise.map(promises, function(asyncResult) {
      return asyncResult;
    })
      .then(function(results) {
        var send = [];
        results.forEach(function(accounts) {
          send = send.concat(accounts);
        });

        send.sort(function(a, b) {
          // sorts unicode
          return a.subtype.localeCompare(b.subtype);
        });
        return res.json(send);
      })
      .catch(function(error) {
        console.log(error);
        return res.status(500).send(error);
      });
  });
};

module.exports.allTransactions = function(req, res) {
  var userid = req.session.passport.user.id;
  var endDate = req.body.endDate;
  var startDate = req.body.startDate;
  var promises = [];
  db.getPlaidItems(userid, function(err, response) {
    // TODO: need to use LET declaration to maintain block scope
    for (let i = 0; i < response.length; i++) {
      promises.push(client.getTransactions(response[i].access_token, startDate, endDate)
        .then(function(data) {
          data.transactions.forEach(function(value) {
            value.institution_name = response[i].institution_name;
          });
          console.log(data.transactions.length);
          return data.transactions;
        })
        .catch(function(error) {
          return error;
        })
      );
    }
    Promise.map(promises, function(asyncResult) {
      return asyncResult;
    })
      .then(function(results) {
        var send = [];
        results.forEach(function(bankTransactions) {
          send = send.concat(bankTransactions);
        });
        console.log(send.length);
        return res.json(send);
      })
      .catch(function(error) {
        return res.status(500).send(error);
      });
  });
};

module.exports.transactions = function (req, res) {
  var userid = req.session.passport.user.id;
  var periodStart = `${req.params.year}-${req.params.month}-01`;

  var today = new Date ();
  var month = (today.getMonth() + 1).toString();
  if (month.length < 2) {
    month = '0'.concat(month);
  }
  var year = today.getFullYear().toString();
  var day = today.getDate().toString();
  if (day.length < 2) {
    day = '0'.concat(day);
  }
  if (month === req.params.month && year === req.params.year) {
    var periodEnd = year + '-' + month + '-' + day;
  } else {
    var oldDate = new Date(parseInt(req.params.year), parseInt(req.params.month), 0);
    var oldMonth = (oldDate.getMonth() + 1).toString();
    if (oldMonth.length < 2) {
      oldMonth = '0'.concat(oldMonth);
    }
    var oldYear = oldDate.getFullYear().toString();
    var oldDay = oldDate.getDate().toString();
    if (oldDay.length < 2) {
      oldDay = '0'.concat(oldDay);
    }
    var periodEnd = oldYear + '-' + oldMonth + '-' + oldDay;
  }

  var promises = [];
  var transactionData = {};
  var plaidInstitutions = [];
  db.getPlaidItems(userid, function(err, response) {
    plaidInstitutions = response;
    for (var i = 0; i < response.length; i++) {
      
      promises.push(client.getTransactions(response[i].access_token, periodStart, periodEnd)
        .then(function(data) {
          return data.transactions;

        })
        .catch(function(error) {
          return error;
        })
      );
    }
    Promise.all(promises)
    .then(function(results) {
      var transactions = [];
      results.forEach(function(array) {
        for (var i = 0; i < array.length; i++) {
          transactions.push(array[i]);
        }
      });

      var categoryObject = {}; 
      for (var i = 0; i < transactions.length; i++) {
        if (transactions[i]['category']) {
          var categoryName = transactions[i]['category'][0];
          if (transactions[i]['category'].length > 0 && categoryName !== 'Payment' && categoryName !== 'Transfer') {
            categoryObject[categoryName] = categoryObject[categoryName] + transactions[i]['amount'] || transactions[i]['amount'];
          } else {
            categoryObject['Other'] = categoryObject['Other'] + transactions[i]['amount'] || transactions[i]['amount'];
          }
        } else {
          categoryObject['Other'] = categoryObject['Other'] + transactions[i]['amount'] || transactions[i]['amount'];
        }
      }
      return res.json(categoryObject);
    })
    .catch(function(error) {
      return res.json({error: 'error in getting transaction data from plaid clients'});
    });
  });
};