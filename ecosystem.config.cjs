module.exports = {
  apps: [
    {
      name: "gray-members-app",
      script: "npm",
      args: "start",
      env: {
        PORT: 3008,
        NODE_ENV: "production"
      }
    }
  ]
};
