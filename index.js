let mysql      = require('mysql');
let Logger = require('istorm_logger');
let df = require('dateformat');

let db_config={};

module.exports = (function () {
    let instance;

    function createInstance(params) {
        params=params? params:{};
        let is_debug=false;
        if(typeof(params.is_debug)!=='undefined'){
            is_debug=params.is_debug;
        }
        if(typeof(params.db_config)!=='undefined'){
            db_config=params.db_config;
        }
        return new DB(is_debug);
    }

    return {
        getInstance: function (params) {
            if (!instance) {
                instance = createInstance(params);
            }
            return instance;
        }
    };
})();

class DB{

    constructor(is_debug){

        if(typeof(is_debug)==='undefined'){
            is_debug=false;
        }

        let context=this;

        this.is_debug=is_debug;
        this.is_connected=false;
        this.is_connecting=false;
        this.queue=[];

        /*this.connect(()=>{
            this.is_connected=true;
        });*/



    }

    connect(callback) {

        if(this.is_connected===true){
            callback();
            return true;
        }

        this.is_connecting=true;

        this.LoggerDebug("DB Connecting..");

        let context=this;

        this.connection = mysql.createConnection(db_config); // Recreate the connection, since



        this.connection.connect(function(err) {              // The server is either down
            if(err) {                                     // or restarting (takes a while sometimes).
                Logger.err('error when connecting to db:'+err);
                //setTimeout(context.connect, 2000); // We introduce a delay before attempting to reconnect,
            }else{
                context.is_connected=true;
                context.is_connecting=false;
                Logger.success("DB connected");
                for(var idx in context.queue){
                    context.query(context.queue[idx][0], context.queue[idx][1]);
                }
                context.queue=[];
                if(typeof(callback)!=="undefined"){
                    callback();
                }
            }                                     // to avoid a hot loop, and to allow our node script to
        });                                     // process asynchronous requests in the meantime.
                                                // If you're also serving http, display a 503 error.
        this.connection.on('error', function(err) {

            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                context.is_connected=false;
                Logger.warn('DB lost connection: '+ err);
                //context.connect();                         // lost due to either server restart, or a
            } else {
                Logger.err('DB error: '+err);// connnection idle timeout (the wait_timeout
                throw err;                                  // server variable configures this)
            }
        });
    }

    query(sql, callback){

        let context=this;

        if(!this.is_connected){

            this.LoggerDebug("DB is not connected");

            if(!this.is_connecting){
                this.LoggerDebug("DB is not connecting...");
                this.connect();
            }

            context.queue.push([sql, callback]);

            this.LoggerDebug("Query queued "+sql);

            return;//Cancel this request due it will be complete by callback
        }


        this.LoggerDebug("SQL: "+sql);


        if(typeof(callback)==="undefined"){
            callback=function () {}
        }

        this.connection.query(sql, function (error, results, fields) {
            if (error) {
                Logger.err("DB error on query: "+sql + "\n" + error);
                //throw error;
                if(error.code==="ECONNRESET"){
                    context.is_connected=false;
                    if(!context.is_connecting){
                        context.LoggerDebug("DB is not connecting...");
                        context.connect();
                    }

                    context.queue.push([sql, callback]);

                    context.LoggerDebug("Query queued "+sql);
                }
            }
            callback(error, results, fields);
        });

    }

    insert(table, data_arr, callback){

        let cols_str="";
        let data_str="";

        for(let name in data_arr){
            let data=data_arr[name];

            if(cols_str.length>0){cols_str=cols_str+","}
            if(data_str.length>0){data_str=data_str+","}

            cols_str=cols_str+name;

            data_str = data_str + mysql.escape(data);

            /*if(typeof(data)==="number"){
                    data_str = data_str + mysql.escape(data);
            }else if(typeof(data)==="string"){
                data_str=data_str+'"'+mysql.escape(data)+'"';
            }else if(typeof(data)==="boolean"){
                data_str=data_str+mysql.escape(data);
            }else{
                data_str=data_str+'"'+mysql.escape(data)+'"';
            }*/

        }

        let stmt=`INSERT INTO ${table} (${cols_str}) VALUES (${data_str})`;

        this.query(stmt, callback);

    }

    select(table, where, order, limit, callback){

        let where_str="";
        for(let name in where){

            let data=where[name];

            if(where_str.length>0){where_str=where_str+" AND "}

            let operand=" = ";
            let param=data;
            if(Array.isArray(data)){
                operand=" "+data[0]+" ";

                if(operand===" IN " || operand===" in "){
                    param="";
                    for(let i=0; i<data[1].length; i++){
                        param=param+(param===""? '':',')+mysql.escape(data[1][i]);
                    }
                    param="("+param+")";
                }else{
                    param=data[1];
                }
            }
            if(operand===" IN " || operand===" in "){
                where_str = where_str + name + operand + param;
            }else {
                if(param===null){
                    if(operand=" = "){
                        where_str = where_str + name + " IS NULL";
                    }else if(operand=" <> "){
                        where_str = where_str + name + " IS NOT NULL";
                    }
                }else {
                    where_str = where_str + name + operand + mysql.escape(param);
                }
            }


        }

        if(where_str.length===0){
            where_str='1';
        }

        let or_str="";
        for(let col in order){
            let dir=order[col];
            if(or_str.length>0){or_str+=", "}
            or_str+=col+" "+dir;
        }

        let stmt=`SELECT * FROM ${table} WHERE ${where_str}`;

        if(or_str!==""){
            stmt=stmt+" ORDER BY "+or_str;
        }

        if(typeof(limit)!=="undefined"){
            stmt+=" LIMIT "+limit;
        }

        this.query(stmt, callback);

    }

    update(table, update, where, callback){

        let where_str="";
        if(typeof(where)==="object") {
        	if(Object.keys(where)===0){
        		throw new Error("Where statement is empty");
        	}
            for (let name in where) {

                let data = where[name];

                if (where_str.length > 0) {
                    where_str = where_str + " AND "
                }

                let operand="=";
                let param=data;
                if(Array.isArray(data)){
                    operand=data[0];
                    param=data[1];
                }

                where_str=where_str+name+operand+mysql.escape(param);

                //where_str=where_str+name+"="+mysql.escape(data);
            }
        }else{
        	if(where.length===0){
        		throw new Error("Where statement is empty");
        	}
            where_str=where;
        }

        let update_str="";
        for(let name in update){

            let data=update[name];

            if(update_str.length>0){update_str=update_str+", "}

            update_str=update_str+name+"="+mysql.escape(data);

        }

        let stmt=`UPDATE ${table} SET ${update_str} WHERE ${where_str}`;

        this.query(stmt, callback);

    }

    disconnect(callback){
        if(typeof(callback)==="undefined"){
            let callback=()=>{};
        }
        if(this.is_connected===false){
            callback();
            return true;
        }
        let context=this;
        this.connection.end(()=>{
            this.is_connected=false;
            Logger.success("DB disconnected");
            callback();
        });
    }

    dateStr(){
        return this.df(new Date());
    }

    escape(str){
        return mysql.escape(str);
    }

    tsToDateStr(timestamp, is_utc){
        var d = new Date();
        d.setTime(timestamp*1000);
        return this.df(d, is_utc);
    }

    df(date, is_utc) {
        if(typeof(is_utc)==="undefined"){
            is_utc=true;
        }

        let format="yyyy-mm-dd HH:MM:ss";

        return df(date, format, is_utc);
    };

    doDBConnect(){
        let context=this;
        return new Promise((resolve, reject) => {
            if(context.is_connected===true){
                resolve(true);
            }
            context.connect(()=>{
                resolve(true);
            });
        });
    };

    doDBDisconnect(){
        let context=this;
        return new Promise((resolve, reject) => {
            if(context.is_connected===false){
                resolve(true);
            }
            context.disconnect(()=>{
                resolve(true);
            });
        });
    };

    doDBSelect(table, where, order, limit) {
        let context=this;
        return new Promise((resolve, reject) => {
            context.select(table, where, order, limit, (error, results, fields)=>{
                if(error){
                    reject(error);
                }
                resolve(results);
            });
        });
    };

    doDBInsert(table, data_arr) {
        let context=this;
        return new Promise((resolve, reject) => {
            context.insert(table, data_arr, (error, result, fields)=>{
                resolve(result);
            });
        });
    };

    doDBUpdate(table, update, where) {
        let context=this;
        return new Promise((resolve, reject) => {
            context.update(table, update, where, (error, results, fields)=>{
                resolve(true);
            });
        });
    };

    doDBQuery(sql){
        let context=this;
        return new Promise((resolve, reject) => {
            context.query(sql, (error, results, fields)=>{
                if(error){
                    reject(error);
                }
                resolve(results);
            });
        });
    };

    LoggerDebug(...messages){
        if(this.is_debug) {
            Logger.dbg(messages);
        }
    }
}