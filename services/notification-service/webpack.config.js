const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
        modulesDir: '../../node_modules',
      }),
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
  };
};
