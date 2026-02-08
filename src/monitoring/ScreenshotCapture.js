import { Platform } from 'react-native';

let ViewShot = null;

try {
  ViewShot = require('react-native-view-shot');
} catch (e) {
  console.warn('react-native-view-shot not installed. Screenshot capture disabled.');
}

class ScreenshotCapture {
  constructor() {
    this.viewRef = null;
    this.enabled = ViewShot != null;
  }

  setViewRef(ref) {
    this.viewRef = ref;
  }

  async captureScreen() {
    if (!this.enabled || !this.viewRef) return null;

    try {
      const uri = await ViewShot.captureRef(this.viewRef, {
        format: 'jpg',
        quality: 0.6,
        result: 'base64'
      });
      return uri;
    } catch (error) {
      console.warn('Screenshot capture failed:', error?.message);
      return null;
    }
  }

  isAvailable() {
    return this.enabled;
  }
}

export default ScreenshotCapture;
