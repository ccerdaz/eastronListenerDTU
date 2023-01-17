

//00 02 f8 75
buf = Buffer.from([0x00, 0x00, 0x00, 0x27]);


console.log(buf.readFloatBE());
console.log(buf.readInt16BE());
console.log(buf.readInt32BE());