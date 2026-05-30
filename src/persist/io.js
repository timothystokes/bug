'use strict';

const fs = require('fs');
const path = require('path');

// Sequential binary (de)serialiser for typed arrays. Bulk numeric state is
// dumped raw (Principle: exact resume); control-plane state goes to JSON.
class ByteWriter {
  constructor() {
    this.chunks = [];
  }

  push(typedArray) {
    this.chunks.push(Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength));
  }

  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

class ByteReader {
  constructor(buffer) {
    this.buf = buffer;
    this.pos = 0;
  }

  read(TypedArrayCtor, length) {
    const bytes = length * TypedArrayCtor.BYTES_PER_ELEMENT;
    // Copy into an aligned buffer so the typed-array view is always valid.
    const slice = Buffer.alloc(bytes);
    this.buf.copy(slice, 0, this.pos, this.pos + bytes);
    this.pos += bytes;
    return new TypedArrayCtor(slice.buffer, 0, length);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exists(dir) {
  return fs.existsSync(path.join(dir, 'meta.json'));
}

module.exports = { ByteWriter, ByteReader, ensureDir, writeJSON, readJSON, exists, path };
