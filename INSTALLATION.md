
npm install github:osarinmwian/secure-http
or 
yarn add github:osarinmwian/secure-http

mainApplication.kt
import com.securehttp.TLSOkHttpClientFactory

app/build.gradle
implementation project(':react-native-secure-http')

settings.gradlew 
include ':react-native-secure-http'
project(':react-native-secure-http').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-secure-http/src/android')

