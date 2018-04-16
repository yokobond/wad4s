/**
 * Created by ky on 2017/04/08.
 */

const http = require('http');

const serverPort = 4848;
const serverIP = '127.0.0.1';

function AudioSynth4ScratchServer(audioWindow) {
  this.audioWindow = audioWindow;
}

AudioSynth4ScratchServer.prototype.createServer = function () {
  const server = http.createServer();
  server.on('request', (req, res) => {
    let content = '';
    const path = decodeURI(req.url).split('/');
    if (!this.audioWindow || this.audioWindow.isDestroyed()) {
      content = '_problem Audio Window is not set.';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write(content);
      res.end();
      return;
    }
    switch (path[1]) {
      case 'poll':
        content += '\n';
        break;
      case 'reset_all':
        // Do something for the stop button pressed in Scratch.
        this.audioWindow.webContents.send('stopAll');
        break;
      case 'setParameter':
        this.audioWindow.webContents.send('setParameter', path[2], path[3]);
        break;
      case 'playNode':
        this.audioWindow.webContents.send('playNode', path[2]);
        break;
      case 'playAll':
        this.audioWindow.webContents.send('playAll');
        break;
      case 'stopNode':
        this.audioWindow.webContents.send('stopNode', path[2]);
        break;
      case 'stopAll':
        this.audioWindow.webContents.send('stopAll');
        break;
      default:
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write(content);
    res.end();
  });

  server.start = function () {
    this.listen(serverPort, serverIP);
  };

  return server;
};

module.exports = AudioSynth4ScratchServer;
