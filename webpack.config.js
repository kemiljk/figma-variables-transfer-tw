const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");
const path = require("path");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";

  return {
    mode: isDevelopment ? "development" : "production",
    devtool: isDevelopment ? "inline-source-map" : false,
    
    entry: {
      ui: "./src/ui.tsx",
      code: "./src/code.ts",
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: "ts-loader",
              options: {
                transpileOnly: isDevelopment,
                experimentalWatchApi: true,
                compilerOptions: {
                  target: "es6",
                },
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
        {
          test: /\.(png|jpg|gif|webp|svg)$/,
          type: "asset",
          parser: {
            dataUrlCondition: {
              maxSize: 10 * 1024, // 10kb
            },
          },
        },
      ],
    },

    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
    },

    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist"),
      clean: true,
    },

    watchOptions: {
      ignored: ["**/node_modules", "**/dist"],
      aggregateTimeout: 100,
      poll: isDevelopment ? 1000 : false,
    },

    optimization: {
      minimize: !isDevelopment,
      moduleIds: "named",
    },

    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(isDevelopment ? "development" : "production"),
      }),
      new HtmlWebpackPlugin({
        inject: "body",
        template: "./src/ui.html",
        filename: "ui.html",
        chunks: ["ui"],
        cache: false,
      }),
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/ui/]),
    ],

    stats: {
      colors: true,
      children: false,
      chunks: false,
      modules: false,
      entrypoints: false,
      assets: true,
    },

    target: ["web", "es6"],
  };
}; 