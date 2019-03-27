const webpack = require('webpack');
const path = require("path");

module.exports = {
  entry: './src/index.ts',
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'powerquery-parser.bundle.dev.js',
    path: path.resolve(__dirname, '../bundle')
  }
}
