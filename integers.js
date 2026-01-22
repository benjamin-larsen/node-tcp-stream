// Signed 8-bit

async function readI8() {
  const buf = await this.readExact(1);
  return buf.readInt8();
}

// Unsigned 8-bit

async function readU8() {
  const buf = await this.readExact(1);
  return buf.readUInt8();
}

// Signed 16-bit

async function readI16BE() {
  const buf = await this.readExact(2);
  return buf.readInt16BE();
}

async function readI16LE() {
  const buf = await this.readExact(2);
  return buf.readInt16LE();
}

// Unsigned 16-bit

async function readU16BE() {
  const buf = await this.readExact(2);
  return buf.readUInt16BE();
}

async function readU16LE() {
  const buf = await this.readExact(2);
  return buf.readUInt16LE();
}

// Signed 32-bit

async function readI32BE() {
  const buf = await this.readExact(4);
  return buf.readInt32BE();
}

async function readI32LE() {
  const buf = await this.readExact(4);
  return buf.readInt32LE();
}

// Unsigned 32-bit

async function readU32BE() {
  const buf = await this.readExact(4);
  return buf.readUInt32BE();
}

async function readU32LE() {
  const buf = await this.readExact(4);
  return buf.readUInt32LE();
}

// Signed 64-bit

async function readI64BE() {
  const buf = await this.readExact(8);
  return buf.readBigInt64BE();
}

async function readI64LE() {
  const buf = await this.readExact(8);
  return buf.readBigInt64LE();
}

// Unsigned 64-bit

async function readU64BE() {
  const buf = await this.readExact(8);
  return buf.readBigUInt64BE();
}

async function readU64LE() {
  const buf = await this.readExact(8);
  return buf.readBigUInt64LE();
}

// Signed 128-bit

async function readI128BE() {
  const buf = await this.readExact(16);
  return (buf.readBigInt64BE(0) << 64n) | buf.readBigInt64BE(8);
}

async function readI128LE() {
  const buf = await this.readExact(16);
  return buf.readBigInt64LE(0) | (buf.readBigInt64LE(8) << 64n);
}

// Unsigned 64-bit

async function readU128BE() {
  const buf = await this.readExact(16);
  return (buf.readBigUInt64BE(0) << 64n) | buf.readBigUInt64BE(8);
}

async function readU128LE() {
  const buf = await this.readExact(16);
  return buf.readBigUInt64LE(0) | (buf.readBigUInt64LE(8) << 64n);
}

// Float 32-bit

async function readF32BE() {
  const buf = await this.readExact(4);
  return buf.readFloatBE();
}

async function readF32LE() {
  const buf = await this.readExact(4);
  return buf.readFloatLE();
}

// Float 64-bit

async function readF64BE() {
  const buf = await this.readExact(8);
  return buf.readDoubleBE();
}

async function readF64LE() {
  const buf = await this.readExact(8);
  return buf.readDoubleLE();
}

module.exports = {
  readI8,
  readU8,
  readI16BE,
  readI16LE,
  readU16BE,
  readU16LE,
  readI32BE,
  readI32LE,
  readU32BE,
  readU32LE,
  readI64BE,
  readI64LE,
  readU64BE,
  readU64LE,
  readI128BE,
  readI128LE,
  readU128BE,
  readU128LE,
  readF32BE,
  readF32LE,
  readF64BE,
  readF64LE,
};