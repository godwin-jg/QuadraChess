/**
 * Simple Notification Service
 * Ultra-minimalistic non-blocking notifications
 */

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration: number;
}

class NotificationService {
  private notifications: Notification[] = [];
  private callback: ((notifications: Notification[]) => void) | null = null;

  /**
   * Set callback to update UI
   */
  setCallback(callback: (notifications: Notification[]) => void) {
    this.callback = callback;
  }

  /**
   * Show notification
   */
  show(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', duration = 2000) {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, message, type, duration };
    
    this.notifications.push(notification);
    this.updateUI();
    
    // Auto-remove after duration
    setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  /**
   * Remove notification
   */
  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.updateUI();
  }

  /**
   * Update UI
   */
  private updateUI() {
    if (this.callback) {
      this.callback([...this.notifications]);
    }
  }

  /**
   * Clear all notifications
   */
  clear() {
    this.notifications = [];
    this.updateUI();
  }
}

export const notificationService = new NotificationService();
export default notificationService;
