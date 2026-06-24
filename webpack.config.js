const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv && argv.mode === 'development';
  return {
    entry: {
      main: './src/index.tsx',
      popout: './src/popout.tsx',
      settings: './src/settings.tsx',
    },
    output: {
      path: path.resolve(__dirname),
      filename: 'dist/[name].bundle.js',
      clean: false,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
      rules: [
        { test: /\.(ts|tsx)$/, use: 'ts-loader', exclude: /node_modules/ },
        { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
        { test: /\.svg$/, type: 'asset/source' },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        chunks: ['main'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        template: './public/popout.html',
        filename: 'popout.html',
        chunks: ['popout'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        template: './public/settings.html',
        filename: 'settings.html',
        chunks: ['settings'],
        inject: 'body',
      }),
      new MiniCssExtractPlugin({ filename: 'dist/styles.css' }),
      new CopyPlugin({ patterns: [{ from: 'SVG', to: 'icons' }] }),
    ],
    externals: {
      fs: 'commonjs fs',
      path: 'commonjs path',
      os: 'commonjs os',
      child_process: 'commonjs child_process',
    },
    devtool: isDev ? 'inline-source-map' : false,
    performance: { hints: false },
  };
};
