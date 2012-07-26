// wrapper for localStorage, sessionStorage and document.cookie
var Vault = (function() {
    var _parse = function(_value) {
        // everything in local storage is a string
        // so let's convert booleans and numbers
        // to be true booleans and numbers
        // and return those
        if (_value===null || _value===undefined) {
            // localStorage["foo"] returns null
            // in some browsers even if 
            // foo isn't there at all.
            // since foo is really undefined,
            // we are returning accordingly
            return undefined;
        }
        if (_value==="true") {
            return true;
        }
        if (_value==="false") {
            return false;
        }
        if (!isNaN(_value)) {
            return parseFloat(_value);
        }
        if (_value.indexOf && (_value.indexOf("{")===0 || _value.indexOf("[")===0) && window.JSON!==undefined) {
            return JSON.parse(_value);
        }
        return _value;
    };
    var _prepare = function(_value) {
        if (typeof _value==="object" && window.JSON!==undefined) {
            return JSON.stringify(_value);
        }
        return _value;
    };
    var _notSupported = function() {
        return undefined;
    };
    var _prepareSqlValue = function(_value) {
        if (isNaN(_value) && _value.indexOf('"')<0) {
            _value = '"' + _value + '"';
        }
        return _value;
    };
    var _parseKeyValueList = function(_pair) {
        var _key, _fields=[], _values=[];
        for (_key in _pair) {
            if (!_key.match(/^\_/)) {
                _fields.push(_key);
                _values.push(_prepareSqlValue(_pair[_key]));
            }
        }
        return {
            fields: _fields,
            values: _values
        };
    };
    var _setup = function(_type) {
        var _storage = window[_type];
        if (_storage===undefined) {
            return {
                get: _notSupported,
                set: _notSupported,
                remove: _notSupported,
                clear: _notSupported,
                list: _notSupported,
                isSupported: function() { return false; }
            };
        }
        return {
            get: function(_key) {
                var _value = _storage[_key];
                return _parse(_value);
            },
            getAndRemove: function(_key) {
                var _value = this.get(_key);
                this.remove(_key);
                return _value;
            },
            set: function(_key, _value) {
                return _storage.setItem(_key, _prepare(_value));
            },
            remove: function(_key) {
                return _storage.removeItem(_key);
            },
            clear: function() {
                return _storage.clear();
            },
            list: function() {
                var i, il=_storage.length;
                if (il===0) {
                    console.log("0 items in "+_type);
                    return undefined;
                }
                for (i in _storage) {
                    console.log(i, "=", _parse(_storage[i]));
                }
            },
            isSupported: function() { return true; }
        };
    };
    var __db__;
    var _db = function() {
        if (window.openDatabase===undefined) {
            return {
                info: _notSupported,
                open: _notSupported,
                createTable: _notSupported,
                dropTable: _notSupported,
                sql: _notSupported,
                get: _notSupported,
                set: _notSupported,
                remove: _notSupported,
                clear: _notSupported,
                list: _notSupported,
                isSupported: function() { return false; }
            };
        }
        return {
            info: function() {
                return __db__;
            },
            open: function(_name, _version, _display_name, _size) {
                __db__ = window.openDatabase(_name, _version, _display_name, _size);
                return __db__;
            },
            create: function(_tables) {
                var _table;
                for (_table in _tables) {
                    var _fields = _tables[_table];
                    var _sql = 'CREATE TABLE IF NOT EXISTS '+_table+' ('+_fields+')';
                    this.sql(_sql);
                }
            },
            drop: function(_tables) {
                var i, il=_tables.length;
                for (i=0; i<il; i++) {
                    var _table = _tables[i];
                    var _sql = 'DROP TABLE '+_table;
                    this.sql(_sql);
                }
            },
            get: function(_args, _success) {
                var _sql = [];
                var _table;
                for (_table in _args) {
                    var _fields = _args[_table];
                    _sql.push('SELECT '+_fields+' FROM '+_table);
                }
                _sql = _sql.join(",");
                this.sql(_sql, _success);
            },
            set: function(_args) {
                var _table;
                for (_table in _args) {
                    var _values = _args[_table];
                    var i, il=_values.length;
                    for (i=0; i<il; i++) {
                        var _set = _values[i];
                        var _pairs = _parseKeyValueList(_set);
                        var _sql;
                        if (_set._where!==undefined) {
                            var _where = _parseKeyValueList(_set._where);
                            var j, jl=_pairs.fields.length, _updates=[];
                            for (j=0; j<jl; j++) {
                                _updates.push(_pairs.fields[j]+'='+_pairs.values[j]);
                            }
                            _sql = 'UPDATE '+_table+' SET '+_updates.join(",")+' WHERE '+_where.fields+'='+_where.values;
                            this.sql(_sql);
                        } else if (_set._delete!==undefined) {
                            var _rm = {};
                            _rm[_table] = [_set._delete];
                            this.remove(_rm);
                        } else {
                            _sql = 'INSERT INTO '+_table+' ('+_pairs.fields+') VALUES ('+_pairs.values+')';
                            this.sql(_sql);
                        }
                    }
                }
            },
            remove: function(_args) {
                var _table;
                for (_table in _args) {
                    var _pairs = _args[_table];
                    var i, il=_pairs.length;
                    for (i=0; i<il; i++) {
                        var _values = _pairs[i];
                        var _delete = _parseKeyValueList(_values);
                        _sql = 'DELETE FROM '+_table+' WHERE '+_delete.fields+'='+_delete.values;
                        this.sql(_sql);
                    }
                }
            },
            clear: function(_tables) {
                var i, il=_tables.length;
                for (i=0; i<il; i++) {
                    var _table = _tables[i];
                    var _sql = 'DELETE FROM '+_table;
                    this.sql(_sql);
                }
            },
            sql: function(_query, _success) {
                if (__db__===undefined) {
                    console.warn("No DB open. Open with:\nVault.DB.open(_name, _version, _display_name, _size);\nQuery: "+_query);
                    return false;
                }
                _success = _success || function() {};
                console.log(_query);
                __db__.transaction(function(_tx) {
                    return _tx.executeSql(_query, [], function(_tx, _results) {
                        if (_results.rows!==undefined) {
                            var i, il=_results.rows.length;
                            var _res = [];
                            for (i=0; i<il; i++) {
                                var _row = _results.rows.item(i);
                                _res.push(_row);
                            }
                            _success(_res);
                        }
                    });
                });
            },
            isSupported: function() { return true; }
        };
    };
    var _cookie = {
        get: function(_cookie) {
            var _cookies = document.cookie.split(";");
            var c, cl=_cookies.length;
            for (c=0; c<cl; c++) {
                var _pair = _cookies[c].split("=");
                _pair[0] = _pair[0].replace(/^[ ]/, "");
                if (_pair[0] === _cookie) {
                    return _parse(_pair[1]);
                }
            }
            return undefined;
        },
        getAndRemove: function(_key) {
            var _value = this.get(_key);
            this.remove(_key);
            return _value;
        },
        set: function(_key, _value, _days, _path) {
            var _expires = "";
            if (_days!==undefined) {
                var _date = new Date();
                _date.setDate(_date.getDate()+_days);
                _expires = "; expires=" + _date.toUTCString();
            }
            var _value = _prepare(_value) + _expires + (_path===undefined ? "" : "; path="+_path);
            document.cookie = _key + "=" + _value;
        },
        remove: function(_key) {
            this.set(_key, "", -1, "/");
        },
        clear: function() {
            var _cookies = document.cookie.split(";");
            var c, cl=_cookies.length;
            for (c=0; c<cl; c++) {
                var _pair = _cookies[c].split("=");
                _pair[0] = _pair[0].replace(/^[ ]/, "");
                this.set(_pair[0], "", -1);
            }
        },
        list: function() {
            var _cookies = document.cookie.split(";");
            var c, cl=_cookies.length;
            if (cl===0) {
                console.log("No cookies set");
                return undefined;
            }
            for (c=0; c<cl; c++) {
                var _pair = _cookies[c].split("=");
                _pair[0] = _pair[0].replace(/^[ ]/, "");
                console.log(_pair[0], "=", _parse(_pair[1]));
            }
        }
    };
    return {
        Local: _setup("localStorage"),
        Session: _setup("sessionStorage"),
        DB: _db(),
        Cookie: _cookie
    };
}());
