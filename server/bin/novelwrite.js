#!/usr/bin/env node
import('../dist/cli/index.js').then(mod => {
  mod.default.parse(process.argv)
}).catch(err => {
  console.error('Failed to start novelwrite CLI:', err.message)
  process.exit(1)
})
