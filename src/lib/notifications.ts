import type { AppData } from "./store";
import { businessDueOn, remaining } from "./business";

// Regista o Service Worker PWA
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (error) {
    console.error("Falha ao registrar Service Worker:", error);
    return null;
  }
}

// Solicita permissão para exibir notificações nativas do Android
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Dispara uma notificação local imediatamente
export async function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const reg = await registerServiceWorker();
  const defaultOptions = {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    ...options,
  } as NotificationOptions;

  if (reg && reg.showNotification) {
    await reg.showNotification(title, defaultOptions);
  } else {
    new Notification(title, defaultOptions);
  }
}

// Verifica contas ou tarefas pendentes para notificar no app
export function checkAndNotifyDueItems(data: AppData) {
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Negócio: recebimentos e pagamentos pendentes com data para hoje
  businessDueOn(data.business, todayStr).forEach((item) => {
    sendLocalNotification(item.kind === "receber" ? "Recebimento pendente hoje" : "Pagamento pendente hoje", {
      body: `${item.party} · ${item.item} - R$ ${remaining(item.amount, item).toFixed(2)}`,
      tag: `biz-${item.id}-${todayStr}`,
    });
  });

  // Notificar contas a pagar que vencem hoje
  const dueBillsToday = data.bills.filter((bill) => !bill.paid && bill.dueDate === todayStr);
  dueBillsToday.forEach((bill) => {
    sendLocalNotification("Conta a Vencer Hoje", {
      body: `${bill.description} - R$ ${bill.amount.toFixed(2)}`,
      tag: `bill-${bill.id}`,
    });
  });

  // Notificar tarefas marcadas para hoje não concluídas
  const pendingTasksToday = data.tasks.filter((task) => !task.done && task.date === todayStr);
  if (pendingTasksToday.length > 0) {
    sendLocalNotification("Tarefas da Rotina", {
      body: `Você tem ${pendingTasksToday.length} tarefa(s) pendente(s) para hoje!`,
      tag: `tasks-${todayStr}`,
    });
  }
}

/** Called after saving a pending record with a future date: asks permission once so
 * the existing daily check can alert on that day when the app is opened. */
export async function ensureReminderFor(dueDate: string | undefined, todayStr: string) {
  if (!dueDate || dueDate < todayStr) return false;
  return (await requestNotificationPermission()) === "granted";
}
