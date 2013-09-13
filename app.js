var express = require('express')
  , app = express()
  , http = require('http')
  , path = require('path')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , RedisStore = require('connect-redis')(express)
  , RedisDB = require('redis')
  , config = require('./config.js')
  , routes = require('./routes')
  , User = require('./models/user');

// configure express
app.configure(function() {
	app.set('port', process.env.PORT || config.dev.PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(passport.initialize());
	// Redis will store sessions
	app.use(express.session( { store: new RedisStore(), secret: 'keyboard cat', cookie: { secure: false, maxAge:86400000 } } ));
	// Initialize Passport!  Also use passport.session() middleware, to support
	// persistent login sessions (recommended).
	app.use(passport.initialize());
	app.use(passport.session());
	// Initialize Passport!  Also use passport.session() middleware, to support
	// persistent login sessions (recommended).	
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));

	// development only
	if ('development' == app.get('env')) {
	  app.use(express.errorHandler());
	}
}); 

app.locals({
    title: 'Feeds Project'
});

// Passport configs

passport.serializeUser(function(user, done) {
  done(null, user);
}); 

passport.deserializeUser(function(user, done) {
  User.getByIndex('username', user.username, function (err, user) {
    done(err, user);
  });
});

passport.use(new LocalStrategy({ usernameField: 'username', passwordField: 'password'},
  function(username, password, done) {
    process.nextTick(function() {
      User.authenticate(username, password, function (error, result) {
        if (error) {
          return done(error);
        } else {
          if (!result.data) {
            return done(null, false, { message: 'Invalid credentials' });
          }else if(!result.data.verifiedPass){
            return done(null, result, { message: 'Invalid password' });
          }
          return done(null, result);            
        }
      });
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: config.dev.facebook.clientID,
    clientSecret: config.dev.facebook.clientSecret,
    callbackURL: "http://192.168.0.104:3000/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
      console.info('accessToken: ' + accessToken);
      console.info('refreshToken: ' + refreshToken);
      console.info('profile: ' + profile);
    //User.findOrCreate(..., function(err, user) {
    //  if (err) { return done(err); }
    //  done(null, user);
    });
  }
));
  
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
}

function isSelf(req, res, next) {
  req.user = new User(req.user);
  if (req.params.id) {
    if (req.user.username === req.params.id) {
      req.isSelf = true;
    } else {
      req.isSelf = false;
    }
  }
  return next();
}

function ensureIsSelf(req, res, next) {
  if (req.isSelf) { return next(); }
  res.redirect('/users/' + req.user.username)
}

// Facebook routes
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback', passport.authenticate('facebook',
  { successRedirect: '/', failureRedirect: '/login' }));

// Routes

app.get('/', routes.site.index);
app.get('/login', routes.users.login);
app.get('/register', routes.users.register);

app.post('/register', routes.users.registerUser);
app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { 
      console.info(err);
      return next(err);
    }
    if (!user.data) {
      console.info("103");
      console.info(info);
      return res.render('login', { "user": req.user, "message": info.message });
    }else if(!user.data.verifiedPass){
      console.info("104");
      return res.render('login', { "user": req.user, "message": info.message });
    }else if (user.data.verifiedPass) {
      var serializeUser = {};
      serializeUser.username = user.data.username;
      serializeUser.password = user.data.password; 
      req.logIn(serializeUser, function(err) {
        if (err) { 
          console.info(err);
          return next(err); 
        } else {
          res.redirect('/users/' + user.data.username);
        }
      });
    }
  })(req, res, next);
});
app.get('/logout', function(req, res){
  req.logout();
  res.redirect("/");
});
app.get('/emailVerification/:id/:vCode', routes.users.emailVerification);
app.post('/resendEmailVerification', routes.users.resendEmailVerification);
app.get('/passwordReset/:id/:vCode', routes.users.passwordReset);
app.post('/passwordReset/:id/:vCode', routes.users.resetPassword);
app.post('/passwordReset', routes.users.sendPasswordReset);

app.get('/users', ensureAuthenticated, routes.users.list);
app.get('/users/:id', ensureAuthenticated, isSelf, routes.users.show);
app.post('/users/:id', ensureAuthenticated, isSelf, ensureIsSelf, routes.users.edit);
app.del('/users/:id', ensureAuthenticated, isSelf, ensureIsSelf, routes.users.del);

app.post('/users/:id/follow', ensureAuthenticated, routes.users.follow);
app.post('/users/:id/unfollow', ensureAuthenticated, routes.users.unfollow);

http.createServer(app).listen(app.get('port'), function(){
  console.log(process.env);
  console.log('Express server listening on port ' + app.get('port'));
});
