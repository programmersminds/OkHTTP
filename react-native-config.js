module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.securehttp.SecureHttpPackage;',
        packageInstance: 'new SecureHttpPackage()',
      },
      ios: {},
    },
  },
};
