'use client';

import { useState, useEffect } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export function useNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    return result === 'granted';
  };

  const sendNotification = (title: string, body: string, icon = '/icon.svg') => {
    if (permission !== 'granted') return;
    new Notification(title, { body, icon });
  };

  return { permission, requestPermission, sendNotification };
}
