import { describe, it, expect, vi } from 'vitest';
import { PubSubManager } from '../../core/PubSub';

describe('PubSubManager', () => {

    // --- subscribe + publish ---

    it('calls subscriber when matching event is published', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('click', callback);
        pubSub.publish('click');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('passes data to subscriber', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('data', callback);
        pubSub.publish('data', 42);
        expect(callback).toHaveBeenCalledWith(42);
    });

    it('passes undefined when publish is called without data', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('ping', callback);
        pubSub.publish('ping');
        expect(callback).toHaveBeenCalledWith(undefined);
    });

    it('passes complex objects as data', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        const payload = { x: 1, y: 2, label: 'test' };
        pubSub.subscribe('move', callback);
        pubSub.publish('move', payload);
        expect(callback).toHaveBeenCalledWith(payload);
    });

    it('calls all subscribers for the same event', () => {
        const pubSub = new PubSubManager();
        const first = vi.fn();
        const second = vi.fn();
        const third = vi.fn();
        pubSub.subscribe('tick', first);
        pubSub.subscribe('tick', second);
        pubSub.subscribe('tick', third);
        pubSub.publish('tick');
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(third).toHaveBeenCalledTimes(1);
    });

    it('does not cross-call subscribers of different events', () => {
        const pubSub = new PubSubManager();
        const onA = vi.fn();
        const onB = vi.fn();
        pubSub.subscribe('eventA', onA);
        pubSub.subscribe('eventB', onB);
        pubSub.publish('eventA');
        expect(onA).toHaveBeenCalledTimes(1);
        expect(onB).not.toHaveBeenCalled();
    });

    it('delivers each publish call independently', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('ping', callback);
        pubSub.publish('ping', 1);
        pubSub.publish('ping', 2);
        pubSub.publish('ping', 3);
        expect(callback).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenNthCalledWith(1, 1);
        expect(callback).toHaveBeenNthCalledWith(2, 2);
        expect(callback).toHaveBeenNthCalledWith(3, 3);
    });

    it('subscribing the same callback twice causes it to be called twice', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('event', callback);
        pubSub.subscribe('event', callback);
        pubSub.publish('event');
        expect(callback).toHaveBeenCalledTimes(2);
    });

    // --- unsubscribe ---

    it('stops calling a subscriber after it is unsubscribed', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('update', callback);
        pubSub.unsubscribe('update', callback);
        pubSub.publish('update');
        expect(callback).not.toHaveBeenCalled();
    });

    it('only removes the unsubscribed callback, not others on the same event', () => {
        const pubSub = new PubSubManager();
        const removed = vi.fn();
        const kept = vi.fn();
        pubSub.subscribe('event', removed);
        pubSub.subscribe('event', kept);
        pubSub.unsubscribe('event', removed);
        pubSub.publish('event');
        expect(removed).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing a callback that was never subscribed does not throw', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        expect(() => pubSub.unsubscribe('ghost', callback)).not.toThrow();
    });

    it('unsubscribing from a non-existent event does not throw', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        expect(() => pubSub.unsubscribe('neverRegistered', callback)).not.toThrow();
    });

    it('unsubscribing the same callback twice does not throw', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('event', callback);
        pubSub.unsubscribe('event', callback);
        expect(() => pubSub.unsubscribe('event', callback)).not.toThrow();
    });

    it('re-subscribing after unsubscribe works normally', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('event', callback);
        pubSub.unsubscribe('event', callback);
        pubSub.subscribe('event', callback);
        pubSub.publish('event');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    // --- publish edge cases ---

    it('publishing to an event with no subscribers does not throw', () => {
        const pubSub = new PubSubManager();
        expect(() => pubSub.publish('nothing')).not.toThrow();
    });

    it('publishing after all subscribers are unsubscribed does not throw', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('event', callback);
        pubSub.unsubscribe('event', callback);
        expect(() => pubSub.publish('event')).not.toThrow();
    });

    it('supports empty string as event name', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('', callback);
        pubSub.publish('');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports special characters in event names', () => {
        const pubSub = new PubSubManager();
        const callback = vi.fn();
        pubSub.subscribe('ns:event/v2.update', callback);
        pubSub.publish('ns:event/v2.update', true);
        expect(callback).toHaveBeenCalledWith(true);
    });

    it('event names are case-sensitive', () => {
        const pubSub = new PubSubManager();
        const lower = vi.fn();
        const upper = vi.fn();
        pubSub.subscribe('click', lower);
        pubSub.subscribe('CLICK', upper);
        pubSub.publish('click');
        expect(lower).toHaveBeenCalledTimes(1);
        expect(upper).not.toHaveBeenCalled();
    });

    it('each PubSubManager instance is independent', () => {
        const pubSubA = new PubSubManager();
        const pubSubB = new PubSubManager();
        const callbackA = vi.fn();
        const callbackB = vi.fn();
        pubSubA.subscribe('event', callbackA);
        pubSubB.subscribe('event', callbackB);
        pubSubA.publish('event');
        expect(callbackA).toHaveBeenCalledTimes(1);
        expect(callbackB).not.toHaveBeenCalled();
    });
});
