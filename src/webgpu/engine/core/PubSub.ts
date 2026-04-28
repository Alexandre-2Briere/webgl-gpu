/** Lightweight event bus: subscribe/unsubscribe callbacks by event name, publish data to all listeners. */
export class PubSubManager {
    private _events: EventMap = {};
    public subscribe(event: string, callback: Subscriber): void {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
    }
    public unsubscribe(event: string, callback: Subscriber): void {
        if (this._events[event]) {
            this._events[event] = this._events[event].filter(cb => cb !== callback);
            if(this._events[event].length === 0) {
                delete this._events[event];
            }
        }
    }
    public publish(event: string, data?: unknown): void {
        if (this._events[event]) {
            this._events[event].forEach(callback => callback(data));
        }
    }
}

type Subscriber = (data?: unknown) => void;
type EventMap = Record<string, Subscriber[]>;