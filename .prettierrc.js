module.exports = {
  semi: false,
  singleQuote: true,
  printWidth: 150,
  tabWidth: 2,
  overrides: [
    {
      files: ['package.json', '*.html'],
      options: {
        useTabs: false,
      },
    },
  ],
}
