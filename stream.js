const integers = require("./integers.js");

const STREAM_CLOSED = Object.freeze(new Error("TCP Stream Closed"));
const STREAM_READ_LIMIT = Object.freeze(
  new Error("Can't read beyond Read Limit"),
);
const STREAM_STATE_CORRUPTED = Object.freeze(
  new Error("Internal state corrupted"),
);

const OP_READ = 0;
const OP_READ_EXACT = 1;
const OP_READ_UNTIL = 2;
const OP_READ_EOF = 3;

// EOF read is not scheduled or active
const NO_EOF = 0;

// EOF read is scheduled, but not active (close will not finalize, but queing more will fail)
const WAIT_EOF = 1;

// EOF read is active, no reads will finish before stream is closed
const ACTIVE_EOF = 2;

class Stream {
  constructor(socket = null, maxRead = 1024 * 1024 /* 1 MiB */) {
    this.maxRead = maxRead;
    this.buffers = [];
    this.bufLen = 0;

    this.eofState = NO_EOF;
    this.readers = [];

    this.isPaused = false;
    this.isClosed = false;

    if (socket) {
      this.socket = socket;
      this.socket.on("data", (data) => this.receive(data));
      this.socket.once("close", () => this.close());
    }
  }

  get canQueue() {
    return !this.isClosed && this.eofState == NO_EOF;
  }

  _faultPaused() {
    if (
      this.eofState == ACTIVE_EOF
      && this.readers.length == 1
    ) {
      this.readers[0].reject(STREAM_READ_LIMIT);
      this.readers = [];
      this.close();

      return true;
    }

    if (
      this.readers.length >= 1
      && this.readers[0].type === OP_READ_UNTIL
    ) {
      for (const reader of this.readers) {
        reader.reject(STREAM_READ_LIMIT);
      }
      
      this.readers = [];
      this.close();

      return true;
    }

    return false;
  }

  _checkPause() {
    if (!this.socket) return;

    if (this.isPaused) {
      if (this._faultPaused()) return;
      
      if (this.bufLen < this.maxRead) {
        this.isPaused = false;
        this.socket.resume();

        console.warn("Stream Resuming: Socket resumed reading data.");
      }
    } else {
      if (this.bufLen >= this.maxRead) {
        if (this._faultPaused()) return;

        this.isPaused = true;
        this.socket.pause();

        console.warn(
          "Stream Pausing: Socket reached Read Limit throttling reading.",
        );
      }
    }
  }

  close() {
    if (this.isClosed) return;

    this.isClosed = true;

    if (
      this.eofState == ACTIVE_EOF
      && this.readers.length == 1
      && this.bufLen > 0
    ) {
      const buf = Buffer.concat(this.buffers);

      if (buf.length === this.bufLen) {
        this.readers[0].resolve(buf);
      } else {
        this.readers[0].reject(STREAM_STATE_CORRUPTED);
      }
    } else {
      for (const reader of this.readers) {
        reader.reject(STREAM_CLOSED);
      }
    }

    this.readers = null;
    this.buffers = null;
    this.bufLen = 0;

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  readExact(n) {
    if (!this.canQueue) return Promise.reject(STREAM_CLOSED);

    if (!Number.isInteger(n) || n < 0) throw Error("Invalid n.");

    if (n == 0) return Promise.resolve(Buffer.alloc(0));
    if (n > this.maxRead) return Promise.reject(STREAM_READ_LIMIT);

    return new Promise((resolve, reject) => {
      this.readers.push({
        resolve,
        reject,
        n,
        type: OP_READ_EXACT,
      });
      this._fulfillPossible(false);
    });
  }

  read(n) {
    if (!this.canQueue) return Promise.reject(STREAM_CLOSED);

    if (!Number.isInteger(n) || n < 0) throw Error("Invalid n.");

    if (n == 0) return Promise.resolve(Buffer.alloc(0));
    if (n > this.maxRead) return Promise.reject(STREAM_READ_LIMIT);

    return new Promise((resolve, reject) => {
      this.readers.push({
        resolve,
        reject,
        n,
        type: OP_READ,
      });
      this._fulfillPossible(false);
    });
  }

  // Reads until delimeter
  // Will close (fail) the socket if reaches maxRead without finding the specified delimiter
  readUntil(delim) {
    if (!this.canQueue) return Promise.reject(STREAM_CLOSED);

    if (typeof delim == "string") delim = Buffer.from(delim);

    if (!Buffer.isBuffer(delim) || delim.length != 1) throw Error("Delimiter must be atleast one character.");

    return new Promise((resolve, reject) => {
      this.readers.push({
        resolve,
        reject,
        delim: delim[0],
        type: OP_READ_UNTIL,
      });
      this._fulfillPossible(false);
    });
  }

  // Read until stream closes, will fail if it overflows maxRead
  // Any subsequent calls to read will fail, as readEOF must be the last call to read.
  readEOF() {
    if (!this.canQueue) return Promise.reject(STREAM_CLOSED);

    this.eofState = WAIT_EOF;

    return new Promise((resolve, reject) => {
      this.readers.push({
        resolve,
        reject,
        type: OP_READ_EOF,
      });
      this._fulfillPossible(false);
    });
  }

  // Resolves when Node.js flushes Write Buffer
  // Not necessary to await, same applies to every other write method.
  write(data, encoding = "utf8") {
    if (!this.socket)
      throw Error("This stream is not assocaited with a TCP socket");
    if (this.isClosed) return Promise.reject(STREAM_CLOSED);

    return new Promise((resolve, reject) => {
      this.socket.write(data, encoding, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  receive(data) {
    if (this.isClosed) return;
    if (!Buffer.isBuffer(data)) throw Error("Received non-buffer data.");

    if (this.isPaused) {
      console.warn("Warning: Data Received when socket was supposedly paused.");
    }

    this.buffers.push(data);
    this.bufLen += data.length;

    this._fulfillPossible(true);
  }

  scanNormal(reader) {
    if (this.bufLen == 0) return true;
    if (reader.type == OP_READ_EXACT && this.bufLen < reader.n) return true;

    let readLen = reader.type == OP_READ_EXACT ? reader.n : Math.min(reader.n, this.bufLen);

    let buf = Buffer.alloc(readLen);
    let pos = 0;
    let left = readLen;
    this.bufLen -= readLen;

    while (left > 0) {
      const nextBuf = this.buffers[0];
      if (!nextBuf) throw STREAM_STATE_CORRUPTED;

      if (nextBuf.length > left) {
        // Copy from read buffer to output.
        nextBuf.copy(buf, pos, 0, left);
        this.buffers[0] = nextBuf.subarray(left);

        // Adjust positions
        pos += left;
        left = 0;
      } else {
        // Copy from read buffer to output.
        nextBuf.copy(buf, pos);

        // Adjust positions
        left -= nextBuf.length;
        pos += nextBuf.length;

        this.buffers.shift();
      }
    }

    reader.resolve(buf);
    this.readers.shift();

    return false;
  }

  findDelim(delim, isData = false) {
    let bufIndex = -1;
    let byteIndex = -1;

    if (isData) {
      // only do last buffer
      bufIndex = this.buffers.length - 1;
      byteIndex = this.buffers[bufIndex].indexOf(delim);
    } else {
      for (const index in this.buffers) {
        bufIndex = index;
        byteIndex = this.buffers[bufIndex].indexOf(delim);

        if (byteIndex !== -1) break;
      }
    }

    if (bufIndex == -1 || byteIndex == -1) return null;

    return {
      bufIndex,
      byteIndex
    }
  }

  scanUntil(reader, isData = false) {
    if (this.bufLen == 0) return true;

    const delimPos = this.findDelim(reader.delim, isData);
    if (!delimPos) return true;

    let bufs = [];

    for (var i = 0; i <= delimPos.bufIndex; i++) {
      const buffer = this.buffers[0];

      if (!buffer) throw STREAM_STATE_CORRUPTED;

      if (i == delimPos.bufIndex) {
        const len = delimPos.byteIndex + 1;

        bufs.push(buffer.subarray(0, len))

        const restBuf = buffer.subarray(len);
        this.bufLen -= len;

        if (restBuf.length > 0) {
          this.buffers[0] = restBuf;
        } else {
          this.buffers.shift();
        }

        break;
      }

      bufs.push(buffer);
      this.bufLen -= buffer.length;
      this.buffers.shift();
    }

    reader.resolve(Buffer.concat(bufs));
    this.readers.shift();

    return false;
  }

  scanEOF() {
    this.eofState = ACTIVE_EOF;
  }

  _fulfillPossible(isData = false) {
    if (this.isClosed) return;

    let reader;

    readLoop:
    while ((reader = this.readers[0])) {
      switch (reader.type) {
        case OP_READ:
        case OP_READ_EXACT: {
          if (this.scanNormal(reader)) break readLoop;
          break;
        }

        case OP_READ_UNTIL: {
          if (this.scanUntil(reader, isData)) break readLoop;
          break;
        }

        case OP_READ_EOF: {
          this.scanEOF();
          break readLoop;
        }
      }
    }

    this._checkPause();
  }
}

Object.assign(Stream.prototype, integers);

module.exports = Stream;
