module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './src/android',
        packageImportPath: 'import com.securehttp.SecureHttpPackage;',
      },
      ios: {
        podspecPath: './react-native-secure-http.podspec',
      },
    },
  },
};
