require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-secure-http"
  s.version      = package["version"]
  s.summary      = package["description"] || "Secure HTTP client for React Native"
  s.homepage     = package["homepage"] || "https://github.com/programmersminds/OkHTTP"
  s.license      = package["license"] || "MIT"
  s.authors      = package["author"] || "Osarinmwian Noel"

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => package["repository"]["url"], :tag => "#{s.version}" }

  s.source_files        = "src/ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"
  s.frameworks = "Security"
end
