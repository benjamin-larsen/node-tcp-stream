# Package
`tcp-stream` is a NodeJS I/O Stream Utility, inspired by Rust's Tokio Crate, intended to control complex stream reads on TCP.

This library abstracts from NodeJS's `read` event implemented on `stream.Readable`, by providing Promise-based methods like `read`, `readExact`, `readUntil` and `readEOF`.

## Example
```js
const TcpStream = require("tcp-stream");
const tls = require("tls");

const netSocket = tls.connect({
  host: "google.com",
  servername: "google.com",
  port: 443,
  ALPNProtocols: ['http/1.1', 'http/1.0']
});

const stream = new TcpStream(netSocket, 1024);

async function run() {
  await stream.write(`GET / HTTP/1.1\r\nHost: google.com\r\n\r\n`);
  const line = (await stream.readUntil("\n")).toString();

  console.log(line);
}

run();
```

# Stream Class
The Stream Class is the default export of this library, it's a class that takes in the Socket and Max Read Size.
```
Socket (optional by passing `null`): when specified the Stream class will take responisbility of adding event listener on `read` and `close` event

Max Read Size (default value of 1 MiB, must be a Integer Number): the limit of the internal Buffer Size before it pauses reads, this will impact the amount of bytes you can read from `read` and `readExact` and may cause `readUntil` and `readEOF` to throw a Error if it runs out.
```

## Errors
When the stream closes before the `read` methods can complete it will throw a `Stream Closed` error.

When the stream throttles because Read Buffer has reached its limit, and therefore is unable to fulfill a `read` method it will throw a `Stream Read Limit` error, and close the stream.

## `read` and `readExact` methods
The `read(N)` and `readExact(N)` methods both read up to N bytes from the stream, however only `readExact(N)` garantuees that it will return exactly N bytes.

## `readUntil` method
The `readUntil(delim: String or Buffer)` method will return a inclusive buffer up to the next delimiter, the function garantuees it will not return until the delimiter is present.

## `readEOF` method
The `readEOF()` will return when the Stream Closes with everything in the Read Buffers.