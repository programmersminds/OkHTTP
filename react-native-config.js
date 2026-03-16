module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './src/android',
        packageImportPath: 'import com.securehttp.SecureHttpPackage;',
        packageInstance: 'new SecureHttpPackage()',
      },
      ios: {},
    },
  },
};
