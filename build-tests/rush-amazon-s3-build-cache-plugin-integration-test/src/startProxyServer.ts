import * as httpProxy from 'http-proxy';
import * as http from 'http';

const proxy: httpProxy = httpProxy.createProxyServer({});

let requestCount: number = 0;
const server: http.Server = http.createServer((req, res) => {
  requestCount += 1;

  if (requestCount % 2 === 0) {
    res.statusCode = 500;
    res.end();
    return;
  }

  proxy.web(req, res, {
    target: 'http://127.0.0.1:9000'
  });
});

server.listen(9002);
