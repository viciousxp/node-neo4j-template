# Node-Neo4j-Passport Boilerplate

This is a node.js app demonstrating the use of passport and basic user management. This app uses neo4j as its database and uses redis to store sessions. 

Features: 
Register/login/logout
Email confirmation
Reset password function by sending an email with a verification code
Update user (only email as demonstration)
Delete user

The basic functions of the app includes following users and see who is following you, as well as viewing other users public accounts.

Todo list:
Facebook login
Twitter login
Clean up code
Ability to create non user objects, have an owner, and allow users to follow objects, see who is folloing objects, as well as tagging.

--- This app will also be branched out to include a version which will integrate angular.js and allow the app to function as a webapp ---

*Note: I am still learning the ins and outs of node, neo4j, and angular, feel free to comment on the code and help with maintenance/updating. Go on an fork this project to get a head start on your own neo4j implementation, and dont forget to commit back to this repository with any improvements you feel should be added!! Enjoy!

-------------------

## Installation

-install neo4j
```bash
# Install the required dependencies
npm install

# Install a local Neo4j instance
curl http://dist.neo4j.org/neo4j-community-1.8.2-unix.tar.gz --O neo4j-community-1.8.2-unix.tar.gz
tar -zxvf neo4j-community-1.8.2-unix.tar.gz
rm neo4j-community-1.8.2-unix.tar.gz
ln -s neo4j-community-1.8.2/bin/neo4j neo4j
```
# Install a local Redis instance
wget http://redis.googlecode.com/files/redis-2.4.16.tar.gz
tar xzf redis-2.4.16.tar.gz
cd redis-2.4.16
make
make test
sudo make install
cd utils
sudo ./install_server.sh
sudo update-rc.d redis_6379 defaults
```
To start and stop redis use: 
	sudo service redis_6379 start
	sudo service redis_6379 stop


## Usage

```bash
# Start the local Neo4j instance
./neo4j start

# Run the app!
npm start
```

The app will now be accessible at [http://localhost:3000/](http://localhost:3000/).

The UI is pretty bad, however this is only for demo purposes and will be upgraded using bootstrap 3.0 in the near futur. 


## Misc

- MIT license.


