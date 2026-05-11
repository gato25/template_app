import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export class NotificationService {
  private static isInitialized = false;

  /**
   * Initializes the Push Notification listeners and requests permission.
   * Safe to call on any platform (fails gracefully on Web/browser).
   */
  public static async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[NotificationService] Not running on native platform. Skipping push notification initialization.');
      return;
    }

    if (this.isInitialized) {
      console.log('[NotificationService] Already initialized.');
      return;
    }

    this.isInitialized = true;
    console.log('[NotificationService] Initializing push notification listeners...');

    try {
      // 1. Add listeners for registration and notification events
      await this.setupListeners();

      // 2. Check and request permissions
      const permStatus = await PushNotifications.checkPermissions();
      console.log('[NotificationService] Current permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        const requestResult = await PushNotifications.requestPermissions();
        console.log('[NotificationService] Requested permissions result:', requestResult.receive);
        
        if (requestResult.receive === 'granted') {
          await this.registerDevice();
        } else {
          console.warn('[NotificationService] Permission denied by the user.');
        }
      } else if (permStatus.receive === 'granted') {
        await this.registerDevice();
      } else {
        console.warn('[NotificationService] Push permission is denied. To enable, adjust your system app settings.');
      }
    } catch (error) {
      console.error('[NotificationService] Error initializing push notifications:', error);
    }
  }

  /**
   * Registers the device with the APNS / FCM server to obtain a token.
   */
  private static async registerDevice(): Promise<void> {
    try {
      console.log('[NotificationService] Registering device with push service...');
      await PushNotifications.register();
    } catch (err) {
      console.error('[NotificationService] Failed to register device natively:', err);
    }
  }

  /**
   * Sets up native event listeners for registration token and incoming notification events.
   */
  private static setupListeners(): void {
    // Successfully registered with APNS / FCM, received device token
    PushNotifications.addListener('registration', (token) => {
      console.log('[NotificationService] Device registration successful!');
      console.log('[NotificationService] Token:', token.value);
      // In a production app, you would send this token to your backend database here:
      // await this.sendTokenToBackend(token.value);
    });

    // Failed to register with APNS / FCM
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[NotificationService] Registration error:', error.error);
    });

    // Received a notification while the app is in the foreground (active)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[NotificationService] Push notification received in foreground:', notification);
      
      // Optionally show a toast, custom alert, or update Svelte state
      const title = notification.title || 'New Notification';
      const body = notification.body || '';
      console.log(`[NotificationService] Foreground Notification - ${title}: ${body}`);
    });

    // User clicked / tapped on a received notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[NotificationService] Push notification action performed (clicked):', action);
      
      const notification = action.notification;
      console.log(`[NotificationService] User clicked notification: ${notification.title}`);
      
      // Handle deep links or custom navigation based on custom data payload:
      if (notification.data && notification.data.url) {
        console.log('[NotificationService] Redirecting to URL:', notification.data.url);
        // e.g. goto(notification.data.url);
      }
    });
  }
}
