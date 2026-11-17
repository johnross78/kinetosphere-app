import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kinetosphere.app',
  appName: 'Kinetosphere',
  webDir: process.env.KINETOSPHERE_IOS_BUILD === '1' ? 'dist/ios-build/www' : 'www',
  server: {
    iosScheme: 'kinetosphere'
  }
};

export default config;
