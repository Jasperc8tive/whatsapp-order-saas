// --- Offline IndexedDB Utility ---
export const offlineDB = {
  db: null as IDBDatabase | null,
  open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const request = indexedDB.open('whatsorder-offline', 3);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        async saveProduct(product: any) {
          const db = await this.open();
          return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readwrite');
            tx.objectStore('products').put(product);
            tx.oncomplete = () => {
              window.dispatchEvent(new Event('offline-product-changed'));
              resolve(undefined);
            };
            tx.onerror = () => reject(tx.error);
          });
        },
        async getProducts() {
          const db = await this.open();
          return new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction('products', 'readonly');
            const req = tx.objectStore('products').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        },
        async clearProducts() {
          const db = await this.open();
          return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readwrite');
            tx.objectStore('products').clear();
            tx.oncomplete = () => {
              window.dispatchEvent(new Event('offline-product-changed'));
              resolve(undefined);
            };
            tx.onerror = () => reject(tx.error);
          });
        },
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  },
    async saveCustomer(customer: any) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readwrite');
        tx.objectStore('customers').put(customer);
        tx.oncomplete = () => {
          window.dispatchEvent(new Event('offline-customer-changed'));
          resolve(undefined);
        };
        tx.onerror = () => reject(tx.error);
      });
    },
    async getCustomers() {
      const db = await this.open();
      return new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('customers', 'readonly');
        const req = tx.objectStore('customers').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async clearCustomers() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readwrite');
        tx.objectStore('customers').clear();
        tx.oncomplete = () => {
          window.dispatchEvent(new Event('offline-customer-changed'));
          resolve(undefined);
        };
        tx.onerror = () => reject(tx.error);
      });
    },
  async saveOrder(order: any) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('orders', 'readwrite');
      tx.objectStore('orders').put(order);
      tx.oncomplete = () => {
        window.dispatchEvent(new Event('offline-order-changed'));
        resolve(undefined);
      };
      tx.onerror = () => reject(tx.error);
    });
  },
  async getOrders() {
    const db = await this.open();
    return new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction('orders', 'readonly');
      const req = tx.objectStore('orders').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async clearOrders() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('orders', 'readwrite');
      tx.objectStore('orders').clear();
      tx.oncomplete = () => {
        window.dispatchEvent(new Event('offline-order-changed'));
        resolve(undefined);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
};
import type { OrderStatus } from "@/types/order";

export function formatCurrency(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function classNames(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}


