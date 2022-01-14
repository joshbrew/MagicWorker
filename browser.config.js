var path = require("path");

var PATHS = {
  entryPoint: path.resolve(__dirname, './src/package.ts'),
  bundles: path.resolve(__dirname, 'dist'),
}

var config = {
  entry: {
    'index': [PATHS.entryPoint],
    'index.min': [PATHS.entryPoint]
  },
  output: {
    path: PATHS.bundles,
    filename: '[name].js',
    library: {
      type: 'umd',
      name: 'magic',
      export: 'default',
      umdNamedDefine: true,
    },
    globalObject: 'this',
    publicPath: '',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      browser: false
    }
  },
  optimization: {
    minimize: false,
  },
  devtool: 'source-map',
  module: {
    rules: [
        { test: /\.tsx?$/, loader: "ts-loader" },
        {
          test: /\.worker\.js$/,
          loader: "worker-loader",
          options: { inline: "fallback" },
        },
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
            // options: {
            //   presets: ['@babel/preset-env'],
            //   plugins: [ "transform-class-properties" ]
            // }
          }
        }
      ],
  },
  // plugins: [
  //   new WorkerPlugin()
  //  ]
}

module.exports = config;