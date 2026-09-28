const config = {
  publicPath: "./",
  configureWebpack: { 
    output: {
      libraryExport: 'default'
    }
  }
}

if (process.env.NODE_ENV === "production") {
  config.configureWebpack.externals = {
    sortablejs: {
      commonjs: "sortablejs",
      commonjs2: "sortablejs",
      amd: "sortablejs",
      root: "Sortable"
    },
    vue: {
      commonjs: "vue",
      commonjs2: "vue",
      amd: "vue",
      root: "Vue"
    }
  };
};

module.exports = config;
