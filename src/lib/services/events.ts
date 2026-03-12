type EventHandler = (data: unknown) => void;

const listeners = new Map<string, Set<EventHandler>>();

export function onEvent(event: string, handler: EventHandler): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(handler);
  return () => {
    listeners.get(event)?.delete(handler);
  };
}

export function emitEvent(event: string, data: unknown): void {
  const handlers = listeners.get(event);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(data);
      } catch {
        // fire-and-forget: event handlers must not break the caller
      }
    }
  }
}

export function clearListeners(): void {
  listeners.clear();
}
