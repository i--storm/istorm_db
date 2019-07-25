# MySQL Wrapper for NodeJs
Class provides automatic mysql connection management

- Simple config and start
- Automatic reconnect to MySQL on connection timeout
- SQL queries buffering while not connected to mysql

# Usage
## Configure
```
DB = require('istorm_db').getInstance({
    is_debug: false,
    db_config: {
      host     : 'localhost',
      user     : 'mysql_user',
      password : 'mysql_password',
      database : 'musql_db_name'
    }
});
```

## Functions
All functions divided into two types. First type begins with 'do' returns Promise object and should be used with `await` call. Second type uses callbacks. You may use most convinient for you.

### Async/Await functions

#### doDBConnect
used internally to connect to database in ASYNC mode

#### doDBDisconnect
used internally to disconnect from database in ASYNC mode

#### doDBSelect(table, where, order, limit)
performs SELECT request to database in ASYNC mode

#### doDBInsert(table, data_arr)
performs INSERT request to database in ASYNC mode

#### doDBUpdate(table, update, where)
performs UPDATE request to database in ASYNC mode

#### doDBQuery(sql)
performs SQL request passed in _sql_ param in ASYNC mode

### Callbck functions

#### connect(callback)
connects to database

#### disconnect(callback)
disconnects from database

#### insert(table, data_arr, callback)
performs INSERT request

#### select(table, where, order, limit, callback)
performs SELECT request

#### update(table, update, where, callback)
performs UPDATE request

#### query(sql, callback)
performs SQL request from string

### Service functions

####  dateStr()
returns current date in mysql format

#### escape(str)
escapes string

#### tsToDateStr(timestamp, is_utc)
converts timestamp to mysql date string

#### df(date, is_utc)
formats date to mysql string

# Important note
All code made for my personal use. I do not promise it will work well in your case. I will try to help if you encountered troubles. You may copy or modify code on your decision.
