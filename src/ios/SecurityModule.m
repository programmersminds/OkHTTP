#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SecurityModule, NSObject)

RCT_EXTERN_METHOD(isRooted:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hasProxy:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isCertificateTampered:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
