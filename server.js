const http = require('http');
const path = require('path');

const static = require('node-static');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 9000;
const WWW_DIR = path.join(__dirname, 'dist');

const file = new static.Server(WWW_DIR);

http.createServer((req, res) => {
  req.addListener('end', () => {
    file.serve(req, res);
  }).resume();
}).listen(PORT, HOST, () => {
  console.log('Listening on %s:%s', HOST, PORT);
});
