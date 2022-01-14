module.exports = function(context, options) {
    return {
      name: 'webpack-worker-plugin',
      configureWebpack(config, isServer) {
        return {
          module: {
            rules: [
                {
                    test: /\.worker\.js$/,
                    loader: "worker-loader",
                    options: { inline: "fallback" },
                  },
            ],
          },
        };
      },
    };
  };