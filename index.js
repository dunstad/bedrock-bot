// require the discord.js module
const Discord = require('discord.js');

const https = require('https');
const config = require('./config.json');

// create a new Discord client
const client = new Discord.Client();

// when the client is ready, run this code
// this event will only trigger one time after logging in
client.once('ready', () => {
	console.log('Ready!');
});

client.on('message', message => {
  console.log(message.content);
  if (message.content === `${config.prefix}ping`) {
    // send back "Pong." to the channel the message was sent in
    message.channel.send('Pong.');
  }
  if (message.content === `${config.prefix}start`) {

  }  
  if (message.content === `${config.prefix}stop`) {

  }
});

// returns minecraft server status as json
// uses https://bedrockinfo.com ()
function getStatus(ip, port) {

  let result = new Promise((resolve, reject)=>{

    port = port || 19132;
    let options = {
      host: 'api.bedrockinfo.com',
      path: `/v1/status?server=${ip}&port=${port}`,
    };

    let req = https.get(options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      if (res.statusCode == 404) {
        reject(res.statusCode);
      }
      console.log('HEADERS: ' + JSON.stringify(res.headers));

      // Buffer the body entirely for processing as a whole.
      let bodyChunks = [];
      res.on('data', function(chunk) {
        // You can process streamed parts here...
        bodyChunks.push(chunk);
      }).on('end', function() {
        let body = Buffer.concat(bodyChunks);
        resolve(body);
      })
    });

    req.on('error', function(e) {
      reject(e.message);
    });

  });

  return result;

}

client.bedrockStatus = {
  online: false,
  players: 0,
};

client.on('ready', () => {

  function updateStatus() {
    // Fetch a channel by its id
    client.channels.fetch(config.channelId)
      .then(bedrockChannel => {
        console.log(bedrockChannel.name)
        getStatus(config.ip).then((body)=>{
          let numPlayers = body.Players !== undefined ? body.Players : client.bedrockStatus.players;
          if (!client.bedrockStatus.online || (client.bedrockStatus.players !== body.Players)) {
            bedrockChannel.send(`${config.ip}: Online!\nPlayers: ${numPlayers}`);
          }
          client.bedrockStatus.online = true;
          client.bedrockStatus.players = numPlayers;
        }).catch((message)=>{
          if (client.bedrockStatus.online) {
            bedrockChannel.send(`${config.ip}: Offline.`);
          }
          client.bedrockStatus.online = false;
          client.bedrockStatus.players = 0;
        });
      })
      .catch(console.error);
  }

  updateStatus();
  // cloudfront caches for five minutes
  // add a bit of extra time because setInterval isn't perfect
  setInterval(updateStatus, 1000 * 60 * 5 + 1000 * 15);

});


// login to Discord with your app's token
client.login(config.token);

