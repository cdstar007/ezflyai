module.exports = {
  apps: [
    {
      name: "tws-watchlist",
      script: "server.mjs",
      cwd: "/home/ubuntu/ezflyai",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3020"
      }
    }
  ]
};
