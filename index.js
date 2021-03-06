// require the discord.js module
const Discord = require('discord.js');

const https = require('https');
const config = require('./config.json');
const { spawn, spawnSync } = require( 'child_process' );
let fs = require('fs');
let archiver = require('archiver');

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
    spawnSync('wsl', ['tmux', 'new-session', '-d', '-s', 'bedrock']);
    spawn('wsl', ['tmux', 'send', '-t', 'bedrock', config.serverPath, 'ENTER']);
    message.channel.send('Starting server.');
  }  
  if (message.content === `${config.prefix}stop`) {

    spawn('wsl', ['tmux', 'send', '-t', 'bedrock', 'stop', 'ENTER']);
    message.channel.send('Stopping server, creating backup...');

    let twentySeconds = 1000 * 20;
    setTimeout(()=>{

      // create a file to stream archive data to.
      // replace colon because windows can't have it in path names
      let output = fs.createWriteStream(config.backupPath + `/${new Date().toISOString().replace(/:/g, '.')}.zip`);
      let archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      // listen for all archive data to be written
      // 'close' event is fired only when a file descriptor is involved
      output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
        message.channel.send('Backup complete.');
      });

      // This event is fired when the data source is drained no matter what was the data source.
      // It is not part of this library but rather from the NodeJS Stream API.
      // @see: https://nodejs.org/api/stream.html#stream_event_end
      output.on('end', function() {
        console.log('Data has been drained');
      });

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          // log warning
        } else {
          // throw error
          throw err;
        }
      });

      // good practice to catch this error explicitly
      archive.on('error', function(err) {
        throw err;
      });

      // pipe archive data to the file
      archive.pipe(output);

      // append files from a directory, putting its contents at the root of archive
      archive.directory(config.worldPath, false);

      // finalize the archive (ie we are done appending files but streams have to finish yet)
      // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
      archive.finalize();

    }, twentySeconds);

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
      let json = '';
      res.on('data', function(chunk) {
        // You can process streamed parts here...
        json += chunk;
      }).on('end', function() {
        if (res.statusCode === 200) {
          try {
              var data = JSON.parse(json);
              // data is available here:
              resolve(data);
          } catch (e) {
              reject('Error parsing JSON!');
          }
        }
        else {
          reject(`Status: ${res.statusCode}`);
        }
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
        getStatus(config.ip).then((body)=>{
          let numPlayers = body.Players !== undefined ? body.Players : client.bedrockStatus.players;
          console.log('status', JSON.stringify(client.bedrockStatus));
          console.log('body', JSON.stringify(body));
          if (!client.bedrockStatus.online || (client.bedrockStatus.players !== body.Players)) {
            bedrockChannel.send(`${config.ip}: Online!\nPlayers: ${numPlayers}\nGame mode: ${body.GameMode}`);
          }
          client.bedrockStatus.online = true;
          client.bedrockStatus.players = numPlayers;
        }).catch((message)=>{
          console.error(message);
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

