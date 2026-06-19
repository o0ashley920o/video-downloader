const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  devServer: (devServerConfig) => {
    devServerConfig.host = '0.0.0.0';
    devServerConfig.allowedHosts = 'all';
    devServerConfig.port = 5173;
    devServerConfig.proxy = {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    };
    return devServerConfig;
  },
};