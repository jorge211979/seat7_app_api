'use strict';

module.exports = {
  apps: [{
    name: 'seat7_api',
    script: 'server/server.js', // Your entry point
    instances: 1,
    autorestart: true, // THIS is the important part, this will tell PM2 to restart your app if it falls over
    max_memory_restart: '1G',
    watch: process.env.NODE_ENV !== 'production',
    ignore_watch: ['node_modules'],
  }],
};
