require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-secure-http"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => package["repository"]["url"], :tag => "#{s.version}" }

  s.source_files        = "src/ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "src/ios/secure_http_crypto.h"
  s.vendored_libraries  = "src/ios/libs/libsecure_http_crypto.a"

  s.dependency "React-Core"
  s.frameworks = "Security"

  s.pod_target_xcconfig = {
    "OTHER_LDFLAGS" => "$(inherited)",
    "LIBRARY_SEARCH_PATHS" => "$(PODS_TARGET_SRCROOT)/src/ios/libs"
  }

  s.script_phases = [
    {
      :name => "Select Rust Static Lib",
      :script => <<~SCRIPT,
        set -e
        LIBS_DIR="${PODS_TARGET_SRCROOT}/src/ios/libs"
        if [ "${PLATFORM_NAME}" = "iphonesimulator" ]; then
          cp "${LIBS_DIR}/libsecure_http_crypto_sim.a" "${LIBS_DIR}/libsecure_http_crypto.a"
        else
          cp "${LIBS_DIR}/libsecure_http_crypto_device.a" "${LIBS_DIR}/libsecure_http_crypto.a"
        fi
      SCRIPT
      :execution_position => :before_compile,
      :output_files => ["$(PODS_TARGET_SRCROOT)/src/ios/libs/libsecure_http_crypto.a"]
    }
  ]
end
