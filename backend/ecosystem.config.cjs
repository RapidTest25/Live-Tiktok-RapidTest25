module.exports = {
  apps: [
    {
      name: "tiktok-live-backend",
      cwd: __dirname,
      script: "server.js",
      interpreter: "node",
      env: {
        PORT: "8081"
      }
    }
  ]
};
