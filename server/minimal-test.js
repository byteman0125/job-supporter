#!/usr/bin/env node

console.log('Hello from minimal test!');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

setTimeout(() => {
  console.log('Test completed successfully');
  process.exit(0);
}, 1000);
