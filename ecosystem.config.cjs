module.exports = {
  apps: [
    {
      name: "seven-members-app",
      script: "npm",
      args: "start",
      env: {
        PORT: 3007,
        NODE_ENV: "production"
      }
    }
  ]
};
