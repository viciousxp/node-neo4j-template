var crypto = require('crypto')
  , nodemailer = require('nodemailer')
  , config = require('../config.js');

// user.js
// User model logic.

var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || config.dev.NEO4J_URL || 'http://localhost:7474');

// constants:

var INDEX_NAME = 'users';
var FOLLOWS_REL = 'follows';

// private constructor:

var User = module.exports = function User(_node) {
    // all we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
}

// public instance properties:

Object.defineProperty(User.prototype, 'id', {
    get: function () { return this._node.id; }
});

Object.defineProperty(User.prototype, 'exists', {
    get: function () { return this._node.exists; }
});

Object.defineProperty(User.prototype, 'email', {
    get: function () {
        return this._node.data['email'];
    },
    set: function (email) {
        this._node.data['email'] = email;
    }
});

Object.defineProperty(User.prototype, 'username', {
    get: function () {
        return this._node.data['username'];
    },
    set: function (username) {
        this._node.data['username'] = username;
    }
});

Object.defineProperty(User.prototype, 'password', {
    get: function () {
        return this._node.data['password'];
    },
    set: function (password) {
        this._node.data['password'] = password;
    }
});

Object.defineProperty(User.prototype, 'emailVerification', {
    get: function () {
        return this._node.data['emailVerification'];
    },
    set: function (emailVerification) {
        this._node.data['emailVerification'] = emailVerification;
    }
});

Object.defineProperty(User.prototype, 'verified', {
    get: function () {
        return this._node.data['verified'];
    },
    set: function (verified) {
        this._node.data['verified'] = verified;
    }
});

Object.defineProperty(User.prototype, 'passwordReset', {
    get: function () {
        return this._node.data['passwordReset'];
    },
    set: function (passwordReset) {
        this._node.data['passwordReset'] = passwordReset;
    }
});

// private instance methods:

User.prototype._getFollowingRel = function (other, callback) {
    var query = [
        'START user=node({userId}), other=node({otherId})',
        'MATCH (user) -[rel?:FOLLOWS_REL]-> (other)',
        'RETURN rel'
    ].join('\n')
        .replace('FOLLOWS_REL', FOLLOWS_REL);

    var params = {
        userId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        var rel = results[0] && results[0]['rel'];
        callback(null, rel);
    });
};

// public instance methods:

User.prototype.save = function (callback) {
    this._node.save(function (err) {
        callback(err);
    });
};

User.prototype.follow = function (other, callback) {
    this._node.createRelationshipTo(other._node, 'follows', {}, function (err, rel) {
        callback(err);
    });
};

User.prototype.unfollow = function (other, callback) {
    this._getFollowingRel(other, function (err, rel) {
        if (err) return callback(err);
        if (!rel) return callback(null);
        rel.del(function (err) {
            callback(err);
        });
    });
};

//deletes all relationships and then delete node
User.prototype.deleteUser = function(callback) {
    // query to delete all relationships
    var deleteAllRelationships = [
        'START n=node({userId})',
        'MATCH n-[rel]-()',
        'delete rel;',
    ].join('\n');

    var params = {
        userId: this.id,
    };
    var user = this;

    db.query(deleteAllRelationships, params, function (err, results) {
        if (err) return callback(err);
        user.del(function (err) {
            if (err) return callback(err);
            callback(null)
        });
    });
}

// calls callback w/ (err, following, others) where following is an array of
// users this user follows, and others is all other users minus him/herself.
User.prototype.getFollowingAndOthers = function (callback) {
    //TODO optimize this code to make it more functional, we need to paginate lists of users

    // query all users we are not already following
    var queryAll = [
        'START user=node({userId}), users=node:INDEX_NAME(\'username:*\')',
        'MATCH (user) -[rel?:FOLLOWS_REL]-> (users)',
        'WHERE rel is null',
        'RETURN users',
    ].join('\n')
        .replace('INDEX_NAME', INDEX_NAME)
        .replace('FOLLOWS_REL', FOLLOWS_REL);

    // query users we are following
    var queryFollowing = [
        'START user=node({userId})',
        'MATCH (user) -[rel:FOLLOWS_REL]-> (users)',
        'RETURN users'
    ].join('\n')
        .replace('FOLLOWS_REL', FOLLOWS_REL);

    // query users following us
    var queryFollowed = [
        'START user=node({userId})',
        'MATCH (user) <-[rel:FOLLOWS_REL]- (users)',
        'RETURN users'
    ].join('\n')
        .replace('FOLLOWS_REL', FOLLOWS_REL);


    var params = {
        userId: this.id,
    };

    var user = this,
        others = [],
        following = [],
        followed = [];

    db.query(queryAll, params, function (err, results) {
        if (err) return callback(err);
        for (var i = 0; i < results.length; i++) {
            var user = new User(results[i]['users']);
            if (params.userId === user.id) {
                continue;
            } else {
                others.push(user);
            }
        }
        db.query(queryFollowing, params, function (err, results) {
            if (err) return callback(err);
            for (var i = 0; i < results.length; i++) {
                var user = new User(results[i]['users']);
                following.push(user);
            }
            db.query(queryFollowed, params, function (err, results) {
                if (err) return callback(err);
                for (var i = 0; i < results.length; i++) {
                    var user = new User(results[i]['users']);
                    followed.push(user);
                }
                callback(null, following, followed, others);
            });
        });
    });
};

// static methods:

User.authenticate = function (username, password, callback) {
  User.getByIndex('username', username, function(error, aUser){
    if(error){
      return callback(null, false);
    }else{
      if(!aUser){
        callback(null, false);
      }else{
        var shasum = crypto.createHash('sha1');
        shasum.update(password);
        input_pass = shasum.digest('hex');
        if(aUser.data.password == input_pass){
          aUser.data.verifiedPass = true;
          return callback(null, aUser);
        }else{
          aUser.data.verifiedPass = false;
          return callback(null, aUser);
        }
      }
    }
  });
};

User.getByIndex = function (property, value, callback) {
    console.info('property:' + property);
    console.info('value:' + value);
    db.getIndexedNode(INDEX_NAME, property, value, function (err, node) {
        if (err) {
            callback(err, null);
        } else if (!node) {
            callback(null, null);
        } else {
            callback(null, node);
        }
    });
};
 
User.get = function (id, callback) {
    console.info('USER GET')
    db.getNodeById(id, function (err, node) {
        if (err) return callback(err);
        callback(null, new User(node));
    });
};

User.getAll = function (callback) {
    db.queryNodeIndex(INDEX_NAME, 'username:*', function (err, nodes) {
        // if (err) return callback(err);
        // XXX FIXME the index might not exist in the beginning, so special-case
        // this error detection. warning: this is super brittle!!
        if (err) return callback(null, []);
        var users = nodes.map(function (node) {
            return new User(node);
        });

        callback(null, users);
    });
};

// creates the user and persists (saves) it to the db, incl. indexing it:
User.create = function (data, callback) {
    //crypto passowrd
    var shasum = crypto.createHash('sha1');
    shasum.update(data.password);
    data.password = shasum.digest('hex');

    var node = db.createNode(data);
    var user = new User(node);
    
    User.getByIndex('username', data.username, function(err, returnedNode) {
        if (err) {
            return callback(err);
        } else if (returnedNode) {
            console.info('user exists');
            return callback('user exists');
        } else {
            node.save(function (err) {
                if (err) return callback(err);
                node.index(INDEX_NAME, 'username', data.username, function (err) {
                    if (err) return callback(err);
                    var message = "<h2>Hello, thank you for signing up, please click the link bellow to verify your email</h2>";
                        message +=   '<a href="http://192.168.0.104:3000/emailVerification/' + data.username + '/' + data.emailVerification + '">Click Here</a>';

                    User.sendEmail(data.email, 'Email Verifivation',message);
                    callback(null, user);
                });
            });
        }
    });
};

User.sendEmail = function (userEmail, subject, message) {
    console.info('sending email verification')
    var smtpTransport = nodemailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
            user: config.dev.nodemail.authUser,
            pass: config.dev.nodemail.authPass
        }
    });

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: "Feeds <node@example.com>",
        to: userEmail,
        subject: subject,
        html: message
    }

    // send mail with defined transport object
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){   
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }
        smtpTransport.close(); // shut down the connection pool, no more messages
    });

}
