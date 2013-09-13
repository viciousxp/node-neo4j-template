/**
 * Module dependencies for passport are required to override passport login function.
 * See req._forceLogIn function for more info.
 */
var http = require('http')
  , req = http.IncomingMessage.prototype
  , crypto = require('crypto');

// users.js
// Routes to CRUD users.

var User = require('../models/user');

/**
 * GET /login
 */
exports.login = function (req, res, next) {
    res.render('login');
};

/**
 * GET /register
 */
exports.register = function (req, res, next) {
    res.render('register');
};

/**
 * GET /users
 */
exports.list = function (req, res, next) {
    User.getAll(function (err, users) {
        if (err) return next(err);
        res.render('users', {
            users: users
        });
    });
};

/**
 * POST /register
 */
exports.registerUser = function (req, res, next) {

    var emailVerification = '';
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (i=0;i<26;i++) {
      var c = Math.floor(Math.random()*chars.length + 1);
      emailVerification += chars.charAt(c)
    }
    User.create({
        username: req.body['username'],
        email: req.body['email'],
        password: req.body['password'],
        emailVerification: emailVerification,
        verified: false
    }, function (err, user) {
        if (err) return next(err);
        req.registeredUser = user;
        console.info('registered user: ' + JSON.stringify(req.registeredUser));
        //we want to immediately log user in, however, the node will take a few seconds
        //to persist in neo4j index, so we will override the req.login (provided by passport)
        //and log user in manually by forcing user provided username and password instead of hitting
        //the DB which will return a user not found error.
        req._forceLogIn(user, function(err) {
            if (err) return next(err);
            res.redirect('/users/' + user.username);
        })
    });
};

exports.emailVerification = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        if (user.emailVerification === req.params.vCode) {
            user.verified = true;
            user.save(function (err) {
                if (err) return next(err);
                req._forceLogIn(user, function(err) {
                    if (err) return next(err);
                    res.redirect('/users/' + user.username);
                })
            });
        } else {
            res.redirect('/');
        }
    });   
}

exports.resendEmailVerification = function (req, res, next) {
    User.getByIndex('username', req.body.username, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        var emailVerification = '';
        var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (i=0;i<26;i++) {
          var c = Math.floor(Math.random()*chars.length + 1);
          emailVerification += chars.charAt(c)
        }
        user.emailVerification = emailVerification;

        user.save(function (err) {
            if (err) return next(err);
            var message = "<h2>Hello, thank you for signing up, please click the link bellow to verify your email</h2>";
                message +=   '<a href="http://192.168.0.104:3000/emailVerification/' + user.username + '/' + emailVerification + '">Click Here</a>';
            User.sendEmail(user.email, 'Email Verifivation', message);
            res.redirect('/login');
        });        
    });
}

exports.sendPasswordReset = function (req, res, next) {
    User.getByIndex('username', req.body.username, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        var passwordReset = '';
        var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (i=0;i<26;i++) {
          var c = Math.floor(Math.random()*chars.length + 1);
          passwordReset += chars.charAt(c)
        }
        user.passwordReset = passwordReset;

        user.save(function (err) {
            if (err) return next(err);
            var message = "<h2>Click on the link to reset your password</h2>";
                message +=   '<a href="http://192.168.0.104:3000/passwordReset/' + user.username + '/' + passwordReset + '">Reset Email</a>';
            User.sendEmail(user.email, 'Password Reset', message);
            res.redirect('/login');
        });        
    });    
}

exports.passwordReset = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        console.info('vCode: ' + user.passwordReset);
        console.info('vCode: ' + req.params.vCode);
        if (user.passwordReset === req.params.vCode) {
            res.render('passwordReset', {
                user: req.params.id,
                vCode: req.params.vCode,
                authentic: true
            });
        } else {
            res.redirect('/');
        }
    }); 
}

exports.resetPassword = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        if (user.passwordReset === req.params.vCode) {
            if (req.body.password) {
                var shasum = crypto.createHash('sha1');
                shasum.update(req.body.password);
                user.password = shasum.digest('hex');
            }
            user.passwordReset = '';
            user.save(function (err) {
                if (err) return next(err);
                req._forceLogIn(user, function(err) {
                    if (err) return next(err);
                    res.redirect('/users/' + user.username);
                })
            });
        } else {
            res.redirect('/');
        }
    });
}

/**
 * GET /users/:id
 */
exports.show = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        // TODO also fetch and show followers? (not just follow*ing*)
        user = new User(user);
        //console.info('USER SHOW: ' + JSON.stringify(user))
        user.getFollowingAndOthers(function (err, following, followed, others) {
            if (err) return next(err);
            res.render('user', {
                isSelf: req.isSelf,
                user: user,
                followed: followed,
                following: following,
                others: others
            });
        });
    });
};

/**
 * POST /users/:id
 */
exports.edit = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        if (req.body.email) {
            user.email = req.body.email;
        }
        user.save(function (err) {
            if (err) return next(err);
            res.redirect('/users/' + user.username);
        });
    });
};

/**
 * DELETE /users/:id
 */
exports.del = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        user.deleteUser(function (err) {
            if (err) return next(err);
            req.logout();
            res.redirect('/');
        });
    });
};

/**
 * POST /users/:id/follow
 */
exports.follow = function (req, res, next) {
    console.info('FOLLOW')
    User.get(req.params.id, function (err, user) {
        if (err) return next(err);
        User.get(req.body.user.id, function (err, other) {
            if (err) return next(err);
            user.follow(other, function (err) {
                if (err) return next(err);
                res.redirect('/users/' + user.username);
            });
        });
    });
};

/**
 * POST /users/:id/unfollow
 */
exports.unfollow = function (req, res, next) {
    User.getByIndex('username', req.params.id, function (err, user) {
        if (err) return next(err);
        if (!user) return next('user does not exist');
        user = new User(user);
        User.get(req.body.user.id, function (err, other) {
            if (err) return next(err);
            user.unfollow(other, function (err) {
                if (err) return next(err);
                res.redirect('/users/' + req.params.id);
            });
        });
    });
};

//override for req.login in passport to avoid hitting the database in situations
//where we want to login the user without asking for their password or in situations
//where we want to login the user but neo4j's index has not been updated yet.
req._forceLogIn = function(user, options, done) {
  if (!this._passport) throw new Error('passport.initialize() middleware not in use');
  
  if (!done && typeof options === 'function') {
    done = options;
    options = {};
  }
  options = options || {};
  var property = this._passport.instance._userProperty || 'user';
  var session = (options.session === undefined) ? true : options.session;
  
  this[property] = user;
  if (session) {
    var self = this;
    var obj = {};
    obj.username = user.username;
    obj.password = user.password;
    self._passport.session.user = obj;
    done();
  } else {
    done && done();
  }
}